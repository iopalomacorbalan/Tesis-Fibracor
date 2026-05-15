-- =========================================================================
-- 034b_asignacion_personal_funciones.sql
-- EJECUTAR DESPUÉS DE 034a (necesita COMMIT del enum)
-- =========================================================================

-- 1. RPC: herramientas personales asignadas a un técnico (sin obra)
CREATE OR REPLACE FUNCTION public.get_herramientas_personales(p_tecnico_id UUID)
RETURNS TABLE (
  item_id UUID,
  item_codigo TEXT,
  descripcion TEXT,
  categoria TEXT,
  unidad TEXT,
  numero_serie TEXT,
  ubicacion_fisica TEXT,
  cantidad_asignada NUMERIC,
  cantidad_devuelta NUMERIC,
  cantidad_pendiente NUMERIC,
  cantidad_en_poder NUMERIC,
  ultima_asignacion TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id AS item_id,
    i.item_id AS item_codigo,
    i.descripcion,
    i.categoria::TEXT,
    i.unidad,
    i.numero_serie,
    i.ubicacion_fisica,
    COALESCE(SUM(CASE WHEN m.tipo = 'Asignacion_personal'::tipo_movimiento THEN m.cantidad ELSE 0 END), 0)::NUMERIC AS cantidad_asignada,
    COALESCE(SUM(CASE WHEN m.tipo = 'Devolucion_personal'::tipo_movimiento THEN m.cantidad ELSE 0 END), 0)::NUMERIC AS cantidad_devuelta,
    COALESCE(SUM(CASE WHEN m.tipo = 'Devolucion_personal_pendiente'::tipo_movimiento THEN m.cantidad ELSE 0 END), 0)::NUMERIC AS cantidad_pendiente,
    (
      COALESCE(SUM(CASE WHEN m.tipo = 'Asignacion_personal'::tipo_movimiento THEN m.cantidad ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN m.tipo = 'Devolucion_personal'::tipo_movimiento THEN m.cantidad ELSE 0 END), 0)
    )::NUMERIC AS cantidad_en_poder,
    MAX(CASE WHEN m.tipo = 'Asignacion_personal'::tipo_movimiento THEN m.fecha END) AS ultima_asignacion
  FROM public.inventario i
  JOIN public.movimientos m ON m.item_id = i.id
  WHERE m.tecnico_id = p_tecnico_id
    AND m.tipo IN (
      'Asignacion_personal'::tipo_movimiento,
      'Devolucion_personal'::tipo_movimiento,
      'Devolucion_personal_pendiente'::tipo_movimiento
    )
  GROUP BY i.id, i.item_id, i.descripcion, i.categoria, i.unidad, i.numero_serie, i.ubicacion_fisica
  HAVING (
    COALESCE(SUM(CASE WHEN m.tipo = 'Asignacion_personal'::tipo_movimiento THEN m.cantidad ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN m.tipo = 'Devolucion_personal'::tipo_movimiento THEN m.cantidad ELSE 0 END), 0)
  ) > 0
  ORDER BY i.descripcion;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_herramientas_personales(UUID) TO authenticated;

-- 2. Trigger para descontar/devolver stock en movimientos personales
CREATE OR REPLACE FUNCTION public.fn_movimiento_personal_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo = 'Asignacion_personal'::tipo_movimiento THEN
    -- Descuenta disponible y suma a "en obra"
    UPDATE public.inventario
    SET stock_disponible = stock_disponible - NEW.cantidad,
        stock_en_obra = stock_en_obra + NEW.cantidad,
        updated_at = NOW()
    WHERE id = NEW.item_id;

  ELSIF NEW.tipo = 'Devolucion_personal'::tipo_movimiento THEN
    -- Devuelve del "en obra" al disponible
    UPDATE public.inventario
    SET stock_disponible = stock_disponible + NEW.cantidad,
        stock_en_obra = stock_en_obra - NEW.cantidad,
        updated_at = NOW()
    WHERE id = NEW.item_id;
  END IF;
  -- Devolucion_personal_pendiente no toca stock

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_movimiento_personal_stock ON public.movimientos;
CREATE TRIGGER trg_movimiento_personal_stock
AFTER INSERT ON public.movimientos
FOR EACH ROW
WHEN (NEW.tipo IN (
  'Asignacion_personal'::tipo_movimiento,
  'Devolucion_personal'::tipo_movimiento
))
EXECUTE FUNCTION public.fn_movimiento_personal_stock();

NOTIFY pgrst, 'reload schema';
SELECT 'Migracion 034b completada' AS estado;
