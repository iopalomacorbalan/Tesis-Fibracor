-- =========================================================================
-- 034_asignacion_personal.sql (CORREGIDO para enum)
-- Tipos de movimiento para asignación personal a técnicos
-- =========================================================================

-- 1. Agregar valores al enum tipo_movimiento
-- IF NOT EXISTS es necesario porque ALTER TYPE ADD VALUE no se puede ejecutar
-- dentro de una transacción y los ENUM no permiten duplicados.
ALTER TYPE tipo_movimiento ADD VALUE IF NOT EXISTS 'Asignacion_personal';
ALTER TYPE tipo_movimiento ADD VALUE IF NOT EXISTS 'Devolucion_personal_pendiente';
ALTER TYPE tipo_movimiento ADD VALUE IF NOT EXISTS 'Devolucion_personal';

-- 2. Permitir obra_id NULL en movimientos (asignaciones personales no van a obra)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'movimientos'
      AND column_name = 'obra_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.movimientos ALTER COLUMN obra_id DROP NOT NULL;
    RAISE NOTICE 'Hizo obra_id nullable';
  END IF;
END $$;

-- IMPORTANTE: hay que hacer COMMIT antes de poder usar los nuevos valores
-- en la misma sesión. Por eso este script se ejecuta en 2 partes.
-- Ejecutá esta primera parte y verificá que aparecen en el enum:
SELECT enumlabel FROM pg_enum
WHERE enumtypid = 'tipo_movimiento'::regtype
ORDER BY enumsortorder;
