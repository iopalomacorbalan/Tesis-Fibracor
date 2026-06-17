-- =========================================================================
-- 056_fix_rls_config_global.sql
-- Permite INSERT y UPDATE en configuracion_global a Direccion/Operaciones/
-- Contabilidad (el upsert necesitaba permiso de INSERT, no solo UPDATE).
-- =========================================================================

-- Asegurar que las claves existan (así el upsert solo hace UPDATE, no INSERT)
INSERT INTO public.configuracion_global (clave, valor, descripcion)
VALUES
  ('valor_hora_liquidacion', '0'::jsonb, 'Valor global hora normal liquidación (ARS)'),
  ('valor_hora_extra_liquidacion', '0'::jsonb, 'Valor global hora extra liquidación (ARS)')
ON CONFLICT (clave) DO NOTHING;

-- Política de UPDATE (Direccion / Operaciones / Contabilidad)
DROP POLICY IF EXISTS "config_update_direccion" ON public.configuracion_global;
CREATE POLICY "config_update_direccion" ON public.configuracion_global
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid()
      AND area IN ('Direccion', 'Operaciones', 'Contabilidad')
      AND activo = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid()
      AND area IN ('Direccion', 'Operaciones', 'Contabilidad')
      AND activo = true
  )
);

-- Política de INSERT (necesaria para que el upsert funcione si la fila no existe)
DROP POLICY IF EXISTS "config_insert_admin" ON public.configuracion_global;
CREATE POLICY "config_insert_admin" ON public.configuracion_global
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid()
      AND area IN ('Direccion', 'Operaciones', 'Contabilidad')
      AND activo = true
  )
);

NOTIFY pgrst, 'reload schema';
SELECT 'Migracion 056 completada — RLS configuracion_global corregido' AS estado;
