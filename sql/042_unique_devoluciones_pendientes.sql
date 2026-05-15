-- =========================================================================
-- 042_unique_devoluciones_pendientes.sql
-- Garantiza a nivel BD que no haya 2 solicitudes pendientes para el mismo
-- técnico+item al mismo tiempo. Protección contra race conditions y bugs.
-- =========================================================================

-- 1. Limpiar duplicados existentes (si los hay, dejamos solo la más antigua)
WITH duplicados AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY tecnico_id, item_id, COALESCE(obra_id::TEXT, 'sin_obra'), tipo
      ORDER BY fecha
    ) AS rn
  FROM public.movimientos
  WHERE tipo IN (
    'Devolucion_pendiente'::tipo_movimiento,
    'Devolucion_personal_pendiente'::tipo_movimiento
  )
)
DELETE FROM public.movimientos
WHERE id IN (SELECT id FROM duplicados WHERE rn > 1);

-- 2. Crear índice único parcial para Devolucion_personal_pendiente
-- (No se puede tener 2 pendientes del mismo técnico+item)
DROP INDEX IF EXISTS idx_unique_devolucion_personal_pendiente;
CREATE UNIQUE INDEX idx_unique_devolucion_personal_pendiente
ON public.movimientos (tecnico_id, item_id)
WHERE tipo = 'Devolucion_personal_pendiente'::tipo_movimiento;

-- 3. Crear índice único parcial para Devolucion_pendiente (de obra)
DROP INDEX IF EXISTS idx_unique_devolucion_pendiente;
CREATE UNIQUE INDEX idx_unique_devolucion_pendiente
ON public.movimientos (tecnico_id, item_id, obra_id)
WHERE tipo = 'Devolucion_pendiente'::tipo_movimiento;

-- Verificar índices creados
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'movimientos'
  AND indexname LIKE '%devolucion%';

NOTIFY pgrst, 'reload schema';
SELECT 'Migracion 042 completada — Protección contra duplicados activa' AS estado;
