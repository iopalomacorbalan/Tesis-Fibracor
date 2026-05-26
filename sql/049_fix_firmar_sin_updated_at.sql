-- =========================================================================
-- 049_fix_firmar_sin_updated_at.sql
-- La tabla remitos no tiene updated_at; lo quitamos de las funciones de firma
-- =========================================================================

-- 1. firmar_remito sin updated_at
CREATE OR REPLACE FUNCTION public.firmar_remito(
  p_token TEXT,
  p_nombre TEXT,
  p_dni TEXT,
  p_firma_imagen TEXT,
  p_items_recibidos JSONB,
  p_observaciones TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remito RECORD;
BEGIN
  SELECT * INTO v_remito FROM public.remitos WHERE firma_token = p_token;
  IF v_remito IS NULL THEN
    RETURN jsonb_build_object('error', 'Remito no encontrado');
  END IF;

  IF p_nombre IS NULL OR TRIM(p_nombre) = '' THEN
    RETURN jsonb_build_object('error', 'El nombre es obligatorio');
  END IF;
  IF p_dni IS NULL OR TRIM(p_dni) = '' THEN
    RETURN jsonb_build_object('error', 'El DNI es obligatorio');
  END IF;

  UPDATE public.remitos
  SET firma_estado = 'firmado',
      firma_nombre = TRIM(p_nombre),
      firma_dni = TRIM(p_dni),
      firma_imagen = p_firma_imagen,
      firma_items_recibidos = p_items_recibidos,
      firma_observaciones = p_observaciones,
      firma_fecha = NOW(),
      recibido_por = TRIM(p_nombre),
      dni_receptor = TRIM(p_dni),
      fecha_recepcion = NOW()
  WHERE firma_token = p_token;

  RETURN jsonb_build_object('ok', true, 'remito_id', v_remito.remito_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.firmar_remito(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT) TO anon, authenticated;

-- 2. resetear_firma_remito sin updated_at
CREATE OR REPLACE FUNCTION public.resetear_firma_remito(p_remito_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid()
      AND area IN ('Direccion', 'Operaciones', 'Comercial', 'Paniol')
      AND activo = true
  ) THEN
    RAISE EXCEPTION 'No tenés permiso para resetear firmas';
  END IF;

  UPDATE public.remitos
  SET firma_estado = 'pendiente',
      firma_nombre = NULL,
      firma_dni = NULL,
      firma_imagen = NULL,
      firma_items_recibidos = NULL,
      firma_observaciones = NULL,
      firma_fecha = NULL,
      recibido_por = NULL,
      dni_receptor = NULL,
      fecha_recepcion = NULL
  WHERE id = p_remito_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resetear_firma_remito(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
SELECT 'Migracion 049 completada — firma sin updated_at' AS estado;
