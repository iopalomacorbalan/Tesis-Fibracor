-- =========================================================================
-- 037_fix_stock_duplicado.sql (CORREGIDO)
-- Recalcula stock_disponible y stock_en_obra desde movimientos reales
-- =========================================================================

-- 1. Diagnóstico: ver items con stock raro
SELECT
  item_id, descripcion, stock_disponible, stock_en_obra
FROM public.inventario
WHERE stock_en_obra < 0 OR stock_disponible < 0;

-- 2. Limpiar pendientes huérfanas
DELETE FROM public.movimientos m1
WHERE m1.tipo = 'Devolucion_personal_pendiente'::tipo_movimiento
  AND EXISTS (
    SELECT 1 FROM public.movimientos m2
    WHERE m2.tipo = 'Devolucion_personal'::tipo_movimiento
      AND m2.tecnico_id = m1.tecnico_id
      AND m2.item_id = m1.item_id
      AND m2.fecha >= m1.fecha
  );

-- 3. DROP previo (la función ya existía con otra firma)
DROP FUNCTION IF EXISTS public.recalcular_stock_item(UUID);

-- 4. Recrear con la nueva firma
CREATE OR REPLACE FUNCTION public.recalcular_stock_item(p_item_id UUID)
RETURNS TABLE (
  item_codigo TEXT,
  disponible_actual NUMERIC,
  disponible_calculado NUMERIC,
  en_obra_actual NUMERIC,
  en_obra_calculado NUMERIC,
  aplicado BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_disp NUMERIC := 0;
  v_obra NUMERIC := 0;
  v_disp_actual NUMERIC;
  v_obra_actual NUMERIC;
  v_codigo TEXT;
BEGIN
  -- Calcular desde movimientos
  SELECT
    COALESCE(SUM(CASE
      WHEN tipo IN ('Ingreso_compra'::tipo_movimiento, 'Ingreso_inicial'::tipo_movimiento, 'Ajuste_positivo'::tipo_movimiento)
        THEN cantidad
      WHEN tipo IN ('Ajuste_negativo'::tipo_movimiento, 'Baja'::tipo_movimiento, 'Retiro'::tipo_movimiento, 'Asignacion_personal'::tipo_movimiento)
        THEN -cantidad
      WHEN tipo IN ('Devolucion'::tipo_movimiento, 'Devolucion_personal'::tipo_movimiento, 'Reactivacion'::tipo_movimiento)
        THEN cantidad
      ELSE 0
    END), 0),
    COALESCE(SUM(CASE
      WHEN tipo IN ('Retiro'::tipo_movimiento, 'Asignacion_personal'::tipo_movimiento)
        THEN cantidad
      WHEN tipo IN ('Devolucion'::tipo_movimiento, 'Devolucion_personal'::tipo_movimiento)
        THEN -cantidad
      ELSE 0
    END), 0)
  INTO v_disp, v_obra
  FROM public.movimientos
  WHERE item_id = p_item_id;

  -- Obtener actual
  SELECT i.stock_disponible, i.stock_en_obra, i.item_id
  INTO v_disp_actual, v_obra_actual, v_codigo
  FROM public.inventario i WHERE i.id = p_item_id;

  -- Aplicar el cálculo
  UPDATE public.inventario
  SET stock_disponible = v_disp,
      stock_en_obra = v_obra,
      updated_at = NOW()
  WHERE id = p_item_id;

  RETURN QUERY SELECT v_codigo, v_disp_actual, v_disp, v_obra_actual, v_obra, true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalcular_stock_item(UUID) TO authenticated;

-- 5. Recalcular items afectados
SELECT i.item_id AS codigo,
       i.descripcion,
       (recalcular_stock_item(i.id)).*
FROM public.inventario i
WHERE i.stock_en_obra < 0
   OR i.stock_disponible < 0
   OR EXISTS (
     SELECT 1 FROM public.movimientos m
     WHERE m.item_id = i.id
       AND m.tipo IN ('Asignacion_personal'::tipo_movimiento, 'Devolucion_personal'::tipo_movimiento)
   );

NOTIFY pgrst, 'reload schema';
SELECT 'Migracion 037 completada' AS estado;
