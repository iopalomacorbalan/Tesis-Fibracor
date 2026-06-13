-- =========================================================================
-- 055_fix_liquidacion_cast.sql
-- Hace robusto el cast de los valores hora (evita que un valor mal formateado
-- rompa la RPC y deje el panel vacío).
-- =========================================================================

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
  v_global_hora NUMERIC := 0;
  v_global_extra NUMERIC := 0;
  v_raw_hora TEXT;
  v_raw_extra TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND u.area IN ('Direccion', 'Operaciones', 'Contabilidad')
      AND u.activo = true
  ) THEN
    RAISE EXCEPTION 'Sin permiso para ver liquidación de horas';
  END IF;

  -- Leer valores globales (columna valor es JSONB). Lo pasamos a texto y casteamos.
  SELECT valor #>> '{}' INTO v_raw_hora FROM public.configuracion_global WHERE clave = 'valor_hora_liquidacion';
  SELECT valor #>> '{}' INTO v_raw_extra FROM public.configuracion_global WHERE clave = 'valor_hora_extra_liquidacion';

  BEGIN
    v_global_hora := COALESCE(NULLIF(REPLACE(TRIM(v_raw_hora), ',', '.'), ''), '0')::NUMERIC;
  EXCEPTION WHEN OTHERS THEN v_global_hora := 0;
  END;
  BEGIN
    v_global_extra := COALESCE(NULLIF(REPLACE(TRIM(v_raw_extra), ',', '.'), ''), '0')::NUMERIC;
  EXCEPTION WHEN OTHERS THEN v_global_extra := 0;
  END;

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
SELECT 'Migracion 055 completada — cast robusto en liquidación' AS estado;
