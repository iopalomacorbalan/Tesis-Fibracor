-- =========================================================================
-- 041_investigar_buzo.sql
-- Ver todo el historial del buzo para entender el descuadre
-- =========================================================================

-- 1. Listar TODOS los movimientos del buzo en orden cronológico
SELECT
  m.id,
  m.mov_id,
  m.tipo,
  m.cantidad,
  m.fecha,
  COALESCE(u.nombre, '—') AS tecnico,
  COALESCE(o.obra_id, '—') AS obra,
  m.observaciones
FROM public.movimientos m
LEFT JOIN public.usuarios u ON u.id = m.tecnico_id
LEFT JOIN public.obras o ON o.id = m.obra_id
WHERE m.item_id = (SELECT id FROM public.inventario WHERE item_id = 'EQP-011')
ORDER BY m.fecha;

-- 2. Sumar cada tipo de movimiento (para ver qué cuenta dio el trigger)
SELECT
  m.tipo,
  SUM(m.cantidad) AS total_cantidad,
  COUNT(*) AS cantidad_movimientos
FROM public.movimientos m
WHERE m.item_id = (SELECT id FROM public.inventario WHERE item_id = 'EQP-011')
GROUP BY m.tipo
ORDER BY m.tipo;

-- 3. Ver cuánto debería quedar según el cálculo
WITH calc AS (
  SELECT
    COALESCE(SUM(CASE
      WHEN m.tipo IN ('Ingreso_compra'::tipo_movimiento, 'Ingreso_inicial'::tipo_movimiento, 'Ajuste_positivo'::tipo_movimiento, 'Reactivacion'::tipo_movimiento) THEN m.cantidad
      WHEN m.tipo IN ('Devolucion'::tipo_movimiento, 'Devolucion_personal'::tipo_movimiento) THEN m.cantidad
      WHEN m.tipo IN ('Ajuste_negativo'::tipo_movimiento, 'Baja'::tipo_movimiento) THEN -m.cantidad
      WHEN m.tipo IN ('Retiro'::tipo_movimiento, 'Asignacion_personal'::tipo_movimiento) THEN -m.cantidad
      ELSE 0
    END), 0) AS disponible_calculado,
    COALESCE(SUM(CASE
      WHEN m.tipo IN ('Retiro'::tipo_movimiento, 'Asignacion_personal'::tipo_movimiento) THEN m.cantidad
      WHEN m.tipo IN ('Devolucion'::tipo_movimiento, 'Devolucion_personal'::tipo_movimiento) THEN -m.cantidad
      ELSE 0
    END), 0) AS en_obra_calculado
  FROM public.movimientos m
  WHERE m.item_id = (SELECT id FROM public.inventario WHERE item_id = 'EQP-011')
)
SELECT
  i.stock_disponible AS disponible_actual,
  c.disponible_calculado,
  i.stock_en_obra AS en_obra_actual,
  c.en_obra_calculado
FROM public.inventario i, calc c
WHERE i.item_id = 'EQP-011';
