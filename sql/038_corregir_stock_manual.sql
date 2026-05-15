-- =========================================================================
-- 038_corregir_stock_manual.sql
-- Ayuda a identificar y corregir stocks fantasma manualmente
-- =========================================================================

-- ===== PASO 1: DIAGNÓSTICO =====
-- Ver TODOS los items que tienen stock_en_obra > 0
-- (te muestra qué items tienen stock "atrapado" en obra)
SELECT
  i.id AS item_uuid,
  i.item_id AS codigo,
  i.descripcion,
  i.stock_disponible AS disponible_actual,
  i.stock_en_obra AS en_obra_actual,
  -- Calcular cuánto DEBERÍA estar en obra según movimientos
  COALESCE((
    SELECT SUM(CASE
      WHEN m.tipo IN ('Retiro'::tipo_movimiento, 'Asignacion_personal'::tipo_movimiento) THEN m.cantidad
      WHEN m.tipo IN ('Devolucion'::tipo_movimiento, 'Devolucion_personal'::tipo_movimiento) THEN -m.cantidad
      ELSE 0
    END)
    FROM public.movimientos m
    WHERE m.item_id = i.id
  ), 0) AS en_obra_calculado_desde_movimientos
FROM public.inventario i
WHERE i.stock_en_obra > 0
ORDER BY i.item_id;

-- ===== PASO 2: RECALCULAR UN ITEM ESPECÍFICO =====
-- Copiá el item_uuid de la lista de arriba y pegalo acá entre las comillas
-- Esto va a recalcular y aplicar el stock correcto desde los movimientos:

-- SELECT * FROM public.recalcular_stock_item('PEGA_UUID_AQUI'::UUID);

-- ===== PASO 3 (alternativa): AJUSTE MANUAL DIRECTO =====
-- Si querés decir "este item tiene X disponible y 0 en obra" sin importar movimientos,
-- usá esto. Reemplazá los valores:

-- UPDATE public.inventario
-- SET stock_disponible = 1,    -- ← poné el número que corresponde
--     stock_en_obra = 0,        -- ← y aquí el que va
--     updated_at = NOW()
-- WHERE item_id = 'CODIGO_DEL_ITEM';   -- ← el código tipo "HER-001"

-- ===== PASO 4 (recomendado para auditoría): REGISTRAR EL AJUSTE COMO MOVIMIENTO =====
-- Esto es lo más prolijo: crea un movimiento de ajuste para que quede trazabilidad

-- INSERT INTO public.movimientos (tipo, item_id, cantidad, fecha, observaciones)
-- SELECT
--   'Ajuste_positivo'::tipo_movimiento,   -- o Ajuste_negativo si hay que sacar
--   i.id,
--   1,                                     -- ← cantidad a ajustar
--   NOW(),
--   'Corrección manual: stock fantasma en obra'
-- FROM public.inventario i
-- WHERE i.item_id = 'CODIGO_DEL_ITEM';
