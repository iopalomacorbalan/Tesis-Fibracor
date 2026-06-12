-- =========================================================================
-- 054_liquidacion_horas.sql
-- Módulo de liquidación de horas: valores hora/hora extra (global + override
-- por técnico) y RPC de liquidación por período con extras (>8h/día).
-- =========================================================================

-- 1. Valores globales en configuracion_global (key/value)
INSERT INTO public.configuracion_global (clave, valor, descripcion)
VALUES
  ('valor_hora_liquidacion', '0', 'Valor global de la hora normal para liquidación de sueldos (ARS)'),
  ('valor_hora_extra_liquidacion', '0', 'Valor global de la hora extra para liquidación de sueldos (ARS)')
ON CONFLICT (clave) DO NOTHING;

-- 2. Override por técnico en usuarios (NULL = usa el global)
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS valor_hora NUMERIC,
  ADD COLUMN IF NOT EXISTS valor_hora_extra NUMERIC;

COMMENT ON COLUMN public.usuarios.valor_hora IS
  'Valor hora normal para liquidación. NULL = usa el valor global.';
COMMENT ON COLUMN public.usuarios.valor_hora_extra IS
  'Valor hora extra para liquidación. NULL = usa el valor global.';

-- 3. Permitir UPDATE de configuracion_global también a Operaciones y Contabilidad
DROP POLICY IF EXISTS "config_update_direccion" ON public.configuracion_global;
CREATE POLICY "config_update_direccion" ON public.configuracion_global
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid()
      AND area IN ('Direccion', 'Operaciones', 'Contabilidad')
      AND activo = true
  )
);

-- 4. RPC de liquidación: horas por técnico por día en un período
-- Las horas salen de los reportes (hora_entrada → hora_salida), sumando
-- todas las obras. Más de 8h en el día = horas extras.
DROP FUNCTION IF EXISTS public.get_liquidacion_horas(DATE, DATE);
CREATE FUNCTION public.get_liquidacion_horas(p_desde DATE, p_hasta DATE)
RETURNS TABLE (
  tecnico_id UUID,
  tecnico_nombre TEXT,
  fecha DATE,
  horas_dia NUMERIC,
  horas_normales NUMERIC,
  horas_extras NUMERIC,
  obras TEXT,
  valor_hora NUMERIC,
  valor_hora_extra NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_global_hora NUMERIC;
  v_global_extra NUMERIC;
BEGIN
  -- Solo Direccion / Operaciones / Contabilidad
  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND u.area IN ('Direccion', 'Operaciones', 'Contabilidad')
      AND u.activo = true
  ) THEN
    RAISE EXCEPTION 'Sin permiso para ver liquidación de horas';
  END IF;

  SELECT COALESCE(valor::NUMERIC, 0) INTO v_global_hora
  FROM public.configuracion_global WHERE clave = 'valor_hora_liquidacion';
  SELECT COALESCE(valor::NUMERIC, 0) INTO v_global_extra
  FROM public.configuracion_global WHERE clave = 'valor_hora_extra_liquidacion';

  RETURN QUERY
  WITH horas_por_dia AS (
    SELECT
      r.tecnico_id AS t_id,
      r.fecha AS f,
      SUM(EXTRACT(EPOCH FROM (r.hora_salida - r.hora_entrada)) / 3600.0)::NUMERIC AS hs,
      STRING_AGG(DISTINCT o.obra_id, ', ') AS obras_dia
    FROM public.reportes r
    LEFT JOIN public.obras o ON o.id = r.obra_id
    WHERE r.fecha BETWEEN p_desde AND p_hasta
      AND r.hora_entrada IS NOT NULL
      AND r.hora_salida IS NOT NULL
      AND r.tecnico_id IS NOT NULL
    GROUP BY r.tecnico_id, r.fecha
  )
  SELECT
    h.t_id,
    u.nombre,
    h.f,
    ROUND(h.hs, 2),
    ROUND(LEAST(h.hs, 8), 2) AS normales,
    ROUND(GREATEST(h.hs - 8, 0), 2) AS extras,
    h.obras_dia,
    COALESCE(u.valor_hora, v_global_hora),
    COALESCE(u.valor_hora_extra, v_global_extra)
  FROM horas_por_dia h
  JOIN public.usuarios u ON u.id = h.t_id
  ORDER BY u.nombre, h.f;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_liquidacion_horas(DATE, DATE) TO authenticated;

NOTIFY pgrst, 'reload schema';
SELECT 'Migracion 054 completada — Liquidación de horas' AS estado;
