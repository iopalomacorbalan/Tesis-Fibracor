-- =========================================================================
-- 040_fix_doble_trigger.sql
-- Elimina el trigger nuevo duplicado y actualiza la función original
-- para que conozca los movimientos personales.
-- =========================================================================

-- 1. Eliminar el trigger que agregué (el viejo ya hace este trabajo)
DROP TRIGGER IF EXISTS trg_movimiento_personal_stock ON public.movimientos;
DROP FUNCTION IF EXISTS public.fn_movimiento_personal_stock();

-- 2. Ver la función original (para no romperla, pero la reescribimos abajo)
-- SELECT pg_get_functiondef('trigger_recalcular_stock'::regproc);

-- 3. Reescribir la función original incluyendo los tipos personales.
-- IMPORTANTE: esta función recalcula stock_disponible y stock_en_obra
-- DESDE CERO basándose en todos los movimientos del item.
CREATE OR REPLACE FUNCTION public.trigger_recalcular_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_id UUID;
BEGIN
  -- Determinar qué item afectó este movimiento
  IF TG_OP = 'DELETE' THEN
    v_item_id := OLD.item_id;
  ELSE
    v_item_id := NEW.item_id;
  END IF;

  -- Recalcular stock_disponible y stock_en_obra desde TODOS los movimientos
  UPDATE public.inventario
  SET
    stock_disponible = COALESCE((
      SELECT SUM(CASE
        -- Ingresos al stock
        WHEN m.tipo IN (
          'Ingreso_compra'::tipo_movimiento,
          'Ingreso_inicial'::tipo_movimiento,
          'Ajuste_positivo'::tipo_movimiento,
          'Reactivacion'::tipo_movimiento
        ) THEN m.cantidad
        -- Devoluciones (suben disponible, bajan en_obra)
        WHEN m.tipo IN (
          'Devolucion'::tipo_movimiento,
          'Devolucion_personal'::tipo_movimiento
        ) THEN m.cantidad
        -- Egresos del stock
        WHEN m.tipo IN (
          'Ajuste_negativo'::tipo_movimiento,
          'Baja'::tipo_movimiento
        ) THEN -m.cantidad
        -- Retiros/Asignaciones (bajan disponible, suben en_obra)
        WHEN m.tipo IN (
          'Retiro'::tipo_movimiento,
          'Asignacion_personal'::tipo_movimiento
        ) THEN -m.cantidad
        ELSE 0
      END)
      FROM public.movimientos m
      WHERE m.item_id = v_item_id
    ), 0),

    stock_en_obra = COALESCE((
      SELECT SUM(CASE
        -- Lo que sale a obra/técnico suma a en_obra
        WHEN m.tipo IN (
          'Retiro'::tipo_movimiento,
          'Asignacion_personal'::tipo_movimiento
        ) THEN m.cantidad
        -- Lo que vuelve resta a en_obra
        WHEN m.tipo IN (
          'Devolucion'::tipo_movimiento,
          'Devolucion_personal'::tipo_movimiento
        ) THEN -m.cantidad
        ELSE 0
      END)
      FROM public.movimientos m
      WHERE m.item_id = v_item_id
    ), 0),

    updated_at = NOW()
  WHERE id = v_item_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- 4. Verificar que solo queda 1 trigger de stock
SELECT tgname AS trigger_name, pg_get_triggerdef(oid) AS definicion
FROM pg_trigger
WHERE tgrelid = 'public.movimientos'::regclass
  AND NOT tgisinternal
ORDER BY tgname;

-- 5. Recalcular el stock del buzo para limpiar el desastre
UPDATE public.inventario SET updated_at = NOW()
WHERE item_id = 'EQP-011';
-- Esto dispara el trigger y recalcula

-- Ver cómo quedó
SELECT item_id, descripcion, stock_disponible, stock_en_obra
FROM public.inventario
WHERE item_id = 'EQP-011';

NOTIFY pgrst, 'reload schema';
SELECT 'Migracion 040 completada — Trigger duplicado eliminado' AS estado;
