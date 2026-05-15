-- =========================================================================
-- 035_rls_movimientos_personales.sql
-- Permitir a técnicos insertar Devolucion_personal_pendiente sobre sí mismos
-- y a paniol/operaciones/direccion gestionar todo el flujo personal
-- =========================================================================

-- 1. Ver qué políticas existen actualmente en movimientos
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT polname FROM pg_policy
             WHERE polrelid = 'public.movimientos'::regclass
  LOOP
    RAISE NOTICE 'Política existente: %', pol.polname;
  END LOOP;
END $$;

-- 2. Política nueva: técnico puede crear Devolucion_personal_pendiente sobre SUS herramientas
DROP POLICY IF EXISTS "tecnico_solicita_devolucion_personal" ON public.movimientos;
CREATE POLICY "tecnico_solicita_devolucion_personal"
ON public.movimientos
FOR INSERT
TO authenticated
WITH CHECK (
  tipo = 'Devolucion_personal_pendiente'::tipo_movimiento
  AND tecnico_id = auth.uid()
);

-- 3. Política: Paniol/Direccion/Operaciones pueden hacer cualquier operación personal
DROP POLICY IF EXISTS "paniol_gestiona_personales" ON public.movimientos;
CREATE POLICY "paniol_gestiona_personales"
ON public.movimientos
FOR ALL
TO authenticated
USING (
  tipo IN (
    'Asignacion_personal'::tipo_movimiento,
    'Devolucion_personal'::tipo_movimiento,
    'Devolucion_personal_pendiente'::tipo_movimiento
  )
  AND EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid()
      AND area IN ('Paniol', 'Direccion', 'Operaciones')
      AND activo = true
  )
)
WITH CHECK (
  tipo IN (
    'Asignacion_personal'::tipo_movimiento,
    'Devolucion_personal'::tipo_movimiento,
    'Devolucion_personal_pendiente'::tipo_movimiento
  )
  AND EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid()
      AND area IN ('Paniol', 'Direccion', 'Operaciones')
      AND activo = true
  )
);

-- 4. Política: técnico puede VER sus propios movimientos personales
DROP POLICY IF EXISTS "tecnico_ve_sus_personales" ON public.movimientos;
CREATE POLICY "tecnico_ve_sus_personales"
ON public.movimientos
FOR SELECT
TO authenticated
USING (
  tipo IN (
    'Asignacion_personal'::tipo_movimiento,
    'Devolucion_personal'::tipo_movimiento,
    'Devolucion_personal_pendiente'::tipo_movimiento
  )
  AND tecnico_id = auth.uid()
);

NOTIFY pgrst, 'reload schema';
SELECT 'Migracion 035 completada — RLS movimientos personales actualizada' AS estado;
