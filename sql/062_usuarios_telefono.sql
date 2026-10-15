-- =========================================================================
-- 062_usuarios_telefono.sql
-- Teléfono de usuarios para avisar por WhatsApp cuando se asigna un técnico
-- =========================================================================

-- 1. Columna telefono en usuarios
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS telefono TEXT;

COMMENT ON COLUMN public.usuarios.telefono IS
  'Celular con WhatsApp (ej: +54 9 351 1234567). Se usa para los avisos de asignación.';

-- 2. Función para guardar el teléfono desde la app
--    (solo Direccion y Operaciones, sin abrir el UPDATE general de usuarios)
CREATE OR REPLACE FUNCTION public.set_telefono_usuario(
  p_usuario_id UUID,
  p_telefono TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid() AND area IN ('Direccion', 'Operaciones') AND activo = true
  ) THEN
    RAISE EXCEPTION 'Sin permiso para editar teléfonos';
  END IF;

  UPDATE public.usuarios
  SET telefono = NULLIF(TRIM(p_telefono), '')
  WHERE id = p_usuario_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_telefono_usuario(UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
SELECT 'Migracion 062 completada — telefono en usuarios' AS estado;
