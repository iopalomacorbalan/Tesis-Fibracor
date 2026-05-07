-- =========================================================================
-- 005_storage_reportes.sql
-- Crea el bucket "reportes-fotos" para subir imágenes de los reportes.
-- Ejecutar en Supabase SQL Editor (proyecto vijqobgrikempdtdgafz)
-- =========================================================================

-- 1. Crear el bucket público (las URLs son públicas pero solo usuarios
--    autenticados pueden subir/borrar)
INSERT INTO storage.buckets (id, name, public)
VALUES ('reportes-fotos', 'reportes-fotos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Policies del bucket
-- Lectura: cualquier usuario autenticado puede ver
DROP POLICY IF EXISTS "reportes_fotos_select" ON storage.objects;
CREATE POLICY "reportes_fotos_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'reportes-fotos');

-- Subir: cualquier usuario autenticado puede subir
DROP POLICY IF EXISTS "reportes_fotos_insert" ON storage.objects;
CREATE POLICY "reportes_fotos_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'reportes-fotos');

-- Borrar: el dueño del archivo o roles superiores
DROP POLICY IF EXISTS "reportes_fotos_delete" ON storage.objects;
CREATE POLICY "reportes_fotos_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'reportes-fotos'
    AND (
      auth.uid() = owner
      OR EXISTS (
        SELECT 1 FROM public.usuarios
        WHERE user_id = auth.uid()
          AND area IN ('Direccion', 'Operaciones')
      )
    )
  );

-- 3. Lectura pública (para mostrar las URLs en la app sin pedir token)
DROP POLICY IF EXISTS "reportes_fotos_public_read" ON storage.objects;
CREATE POLICY "reportes_fotos_public_read"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'reportes-fotos');
