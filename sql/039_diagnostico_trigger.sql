-- =========================================================================
-- 039_diagnostico_trigger.sql
-- Investigar por qué el trigger multiplica el stock
-- =========================================================================

-- 1. Ver los últimos movimientos de Asignacion_personal del buzo
SELECT
  m.id,
  m.tipo,
  m.cantidad,
  m.fecha,
  m.tecnico_id,
  m.obra_id,
  m.observaciones,
  i.item_id,
  i.descripcion,
  i.stock_disponible AS stock_actual_disponible,
  i.stock_en_obra AS stock_actual_en_obra
FROM public.movimientos m
JOIN public.inventario i ON i.id = m.item_id
WHERE i.item_id = 'EQP-011'  -- el buzo
  AND m.tipo IN ('Asignacion_personal'::tipo_movimiento, 'Devolucion_personal'::tipo_movimiento, 'Devolucion_personal_pendiente'::tipo_movimiento)
ORDER BY m.fecha DESC
LIMIT 10;

-- 2. Ver TODOS los triggers que tiene la tabla movimientos
SELECT
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'movimientos'
ORDER BY trigger_name;

-- 3. Ver pg_trigger directamente (más detalle)
SELECT
  tgname AS trigger_name,
  tgenabled AS habilitado,
  pg_get_triggerdef(oid) AS definicion
FROM pg_trigger
WHERE tgrelid = 'public.movimientos'::regclass
  AND NOT tgisinternal
ORDER BY tgname;
