-- =========================================================================
-- 036_rls_tecnicos_ven_sus_obras.sql
-- Garantizar que los técnicos vean TODAS las obras donde están asignados
-- =========================================================================

-- 1. Ver políticas actuales (para diagnóstico)
DO $$
DECLARE
  pol RECORD;
BEGIN
  RAISE NOTICE '=== Políticas de obras ===';
  FOR pol IN SELECT polname FROM pg_policy WHERE polrelid = 'public.obras'::regclass
  LOOP
    RAISE NOTICE '  %', pol.polname;
  END LOOP;

  RAISE NOTICE '=== Políticas de obra_tecnicos ===';
  FOR pol IN SELECT polname FROM pg_policy WHERE polrelid = 'public.obra_tecnicos'::regclass
  LOOP
    RAISE NOTICE '  %', pol.polname;
  END LOOP;
END $$;

-- 2. Política: técnico puede leer obra_tecnicos donde figure
-- (necesaria para que la JOIN en useObras() le devuelva sus asignaciones)
DROP POLICY IF EXISTS "tecnico_ve_sus_asignaciones" ON public.obra_tecnicos;
CREATE POLICY "tecnico_ve_sus_asignaciones"
ON public.obra_tecnicos
FOR SELECT
TO authenticated
USING (
  tecnico_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid()
      AND area IN ('Direccion', 'Operaciones', 'Paniol', 'Comercial', 'Contabilidad')
      AND activo = true
  )
);

-- 3. Política: técnico puede ver las obras donde figura como técnico asignado
DROP POLICY IF EXISTS "tecnico_ve_sus_obras" ON public.obras;
CREATE POLICY "tecnico_ve_sus_obras"
ON public.obras
FOR SELECT
TO authenticated
USING (
  -- O es responsable (todos)
  EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid()
      AND area IN ('Direccion', 'Operaciones', 'Paniol', 'Comercial', 'Contabilidad')
      AND activo = true
  )
  -- O es técnico asignado a esta obra
  OR EXISTS (
    SELECT 1 FROM public.obra_tecnicos ot
    WHERE ot.obra_id = obras.id
      AND ot.tecnico_id = auth.uid()
  )
  -- O es el jefe de obra
  OR jefe_obra_id = auth.uid()
);

-- 4. Asegurarse que RLS esté habilitado
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obra_tecnicos ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';

-- 5. Diagnóstico: contar obras por técnico
SELECT
  u.nombre AS tecnico,
  COUNT(DISTINCT ot.obra_id) AS obras_asignadas,
  ARRAY_AGG(o.obra_id ORDER BY o.obra_id) FILTER (WHERE o.id IS NOT NULL) AS codigos_obras
FROM public.usuarios u
LEFT JOIN public.obra_tecnicos ot ON ot.tecnico_id = u.id
LEFT JOIN public.obras o ON o.id = ot.obra_id
WHERE u.area = 'Tecnico' AND u.activo = true
GROUP BY u.id, u.nombre
ORDER BY u.nombre;
