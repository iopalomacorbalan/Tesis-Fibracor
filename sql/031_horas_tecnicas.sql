-- =========================================================================
-- 031_horas_tecnicas.sql
-- Sistema de horas técnicas en reportes + precio hora configurable
-- =========================================================================

-- ===== 1. Agregar columnas de horario a reportes =====
ALTER TABLE public.reportes
  ADD COLUMN IF NOT EXISTS hora_entrada TIME,
  ADD COLUMN IF NOT EXISTS hora_salida TIME;

-- ===== 2. Tabla reporte_tecnicos (M:N con técnicos presentes) =====
CREATE TABLE IF NOT EXISTS public.reporte_tecnicos (
  reporte_id UUID NOT NULL REFERENCES public.reportes(id) ON DELETE CASCADE,
  tecnico_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (reporte_id, tecnico_id)
);

CREATE INDEX IF NOT EXISTS idx_reporte_tecnicos_reporte ON public.reporte_tecnicos(reporte_id);
CREATE INDEX IF NOT EXISTS idx_reporte_tecnicos_tecnico ON public.reporte_tecnicos(tecnico_id);

-- ===== 3. Tabla configuracion_global (key/value para parámetros del sistema) =====
CREATE TABLE IF NOT EXISTS public.configuracion_global (
  clave TEXT PRIMARY KEY,
  valor JSONB NOT NULL,
  descripcion TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES public.usuarios(id)
);

-- Insertar valor inicial precio hora
INSERT INTO public.configuracion_global (clave, valor, descripcion)
VALUES (
  'precio_hora_tecnica',
  '{"amount": 0, "currency": "ARS"}'::jsonb,
  'Precio por hora trabajada de un técnico (se aplica al costo de la obra)'
)
ON CONFLICT (clave) DO NOTHING;

-- ===== 4. RLS de configuracion_global =====
ALTER TABLE public.configuracion_global ENABLE ROW LEVEL SECURITY;

-- Todos los autenticados pueden LEER (necesario para que la app sepa el precio)
DROP POLICY IF EXISTS "config_select_all" ON public.configuracion_global;
CREATE POLICY "config_select_all" ON public.configuracion_global
  FOR SELECT
  TO authenticated
  USING (true);

-- Solo Direccion puede UPDATE
DROP POLICY IF EXISTS "config_update_direccion" ON public.configuracion_global;
CREATE POLICY "config_update_direccion" ON public.configuracion_global
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE id = auth.uid() AND area = 'Direccion'
    )
  );

-- ===== 5. RLS de reporte_tecnicos (todos los autenticados ven, solo el creador del reporte modifica) =====
ALTER TABLE public.reporte_tecnicos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reporte_tec_select" ON public.reporte_tecnicos;
CREATE POLICY "reporte_tec_select" ON public.reporte_tecnicos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "reporte_tec_insert" ON public.reporte_tecnicos;
CREATE POLICY "reporte_tec_insert" ON public.reporte_tecnicos
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "reporte_tec_delete" ON public.reporte_tecnicos;
CREATE POLICY "reporte_tec_delete" ON public.reporte_tecnicos
  FOR DELETE TO authenticated USING (true);

-- ===== 6. RPC: calcular horas técnicas por obra =====
CREATE OR REPLACE FUNCTION public.get_horas_tecnicas_obra(p_obra_id UUID)
RETURNS TABLE (
  tecnico_id UUID,
  tecnico_nombre TEXT,
  cantidad_reportes INTEGER,
  total_horas NUMERIC,
  costo_total NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_precio_hora NUMERIC;
BEGIN
  -- Obtener precio actual
  SELECT (valor->>'amount')::NUMERIC INTO v_precio_hora
  FROM public.configuracion_global
  WHERE clave = 'precio_hora_tecnica';

  v_precio_hora := COALESCE(v_precio_hora, 0);

  RETURN QUERY
  SELECT
    u.id AS tecnico_id,
    u.nombre AS tecnico_nombre,
    COUNT(DISTINCT r.id)::INTEGER AS cantidad_reportes,
    COALESCE(
      SUM(
        EXTRACT(EPOCH FROM (r.hora_salida - r.hora_entrada)) / 3600.0
      ),
      0
    )::NUMERIC AS total_horas,
    COALESCE(
      SUM(
        (EXTRACT(EPOCH FROM (r.hora_salida - r.hora_entrada)) / 3600.0) * v_precio_hora
      ),
      0
    )::NUMERIC AS costo_total
  FROM public.reporte_tecnicos rt
  JOIN public.reportes r ON r.id = rt.reporte_id
  JOIN public.usuarios u ON u.id = rt.tecnico_id
  WHERE r.obra_id = p_obra_id
    AND r.hora_entrada IS NOT NULL
    AND r.hora_salida IS NOT NULL
  GROUP BY u.id, u.nombre
  ORDER BY u.nombre;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_horas_tecnicas_obra(UUID) TO authenticated;

-- ===== 7. RPC: total general de horas y costo por obra =====
CREATE OR REPLACE FUNCTION public.get_total_horas_obra(p_obra_id UUID)
RETURNS TABLE (
  total_horas NUMERIC,
  cantidad_tecnicos INTEGER,
  cantidad_reportes INTEGER,
  costo_total NUMERIC,
  precio_hora_actual NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_precio_hora NUMERIC;
BEGIN
  SELECT (valor->>'amount')::NUMERIC INTO v_precio_hora
  FROM public.configuracion_global
  WHERE clave = 'precio_hora_tecnica';

  v_precio_hora := COALESCE(v_precio_hora, 0);

  RETURN QUERY
  WITH horas AS (
    SELECT
      rt.tecnico_id,
      r.id AS reporte_id,
      EXTRACT(EPOCH FROM (r.hora_salida - r.hora_entrada)) / 3600.0 AS horas
    FROM public.reporte_tecnicos rt
    JOIN public.reportes r ON r.id = rt.reporte_id
    WHERE r.obra_id = p_obra_id
      AND r.hora_entrada IS NOT NULL
      AND r.hora_salida IS NOT NULL
  )
  SELECT
    COALESCE(SUM(horas), 0)::NUMERIC AS total_horas,
    COUNT(DISTINCT tecnico_id)::INTEGER AS cantidad_tecnicos,
    COUNT(DISTINCT reporte_id)::INTEGER AS cantidad_reportes,
    (COALESCE(SUM(horas), 0) * v_precio_hora)::NUMERIC AS costo_total,
    v_precio_hora AS precio_hora_actual
  FROM horas;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_total_horas_obra(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ===== Verificación =====
SELECT 'Migracion completada' AS estado;
SELECT clave, valor FROM public.configuracion_global;
