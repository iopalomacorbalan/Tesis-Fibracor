-- =========================================================================
-- 032_horas_por_dia.sql
-- RPC para obtener horas técnicas agrupadas por día/reporte
-- =========================================================================

-- RPC: horas agrupadas por reporte (cada reporte = un día/sesión)
CREATE OR REPLACE FUNCTION public.get_horas_por_dia_obra(p_obra_id UUID)
RETURNS TABLE (
  reporte_id UUID,
  reporte_codigo TEXT,
  fecha DATE,
  hora_entrada TIME,
  hora_salida TIME,
  horas_dia NUMERIC,
  cantidad_asistentes INTEGER,
  asistentes JSONB,
  costo_dia NUMERIC
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
  SELECT
    r.id AS reporte_id,
    r.reporte_id AS reporte_codigo,
    r.fecha::DATE,
    r.hora_entrada,
    r.hora_salida,
    (EXTRACT(EPOCH FROM (r.hora_salida - r.hora_entrada)) / 3600.0)::NUMERIC AS horas_dia,
    COUNT(rt.tecnico_id)::INTEGER AS cantidad_asistentes,
    COALESCE(
      jsonb_agg(
        jsonb_build_object('id', u.id, 'nombre', u.nombre, 'area', u.area)
        ORDER BY u.nombre
      ) FILTER (WHERE u.id IS NOT NULL),
      '[]'::jsonb
    ) AS asistentes,
    (
      (EXTRACT(EPOCH FROM (r.hora_salida - r.hora_entrada)) / 3600.0)
      * COUNT(rt.tecnico_id)
      * v_precio_hora
    )::NUMERIC AS costo_dia
  FROM public.reportes r
  LEFT JOIN public.reporte_tecnicos rt ON rt.reporte_id = r.id
  LEFT JOIN public.usuarios u ON u.id = rt.tecnico_id
  WHERE r.obra_id = p_obra_id
    AND r.hora_entrada IS NOT NULL
    AND r.hora_salida IS NOT NULL
  GROUP BY r.id, r.reporte_id, r.fecha, r.hora_entrada, r.hora_salida
  ORDER BY r.fecha DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_horas_por_dia_obra(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';

SELECT 'Migracion 032 completada' AS estado;
