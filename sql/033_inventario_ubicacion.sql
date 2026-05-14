-- =========================================================================
-- 033_inventario_ubicacion.sql
-- Agregar campo "ubicacion_fisica" a inventario para tracking en pañol
-- =========================================================================

ALTER TABLE public.inventario
  ADD COLUMN IF NOT EXISTS ubicacion_fisica TEXT;

COMMENT ON COLUMN public.inventario.ubicacion_fisica IS
  'Ubicación física del item en pañol/estantería (ej: AB-105, Estante 3-A, Caja 12)';

NOTIFY pgrst, 'reload schema';
SELECT 'Migracion 033 completada' AS estado;
