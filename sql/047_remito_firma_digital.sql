-- =========================================================================
-- 047_remito_firma_digital.sql
-- Firma digital de remitos vía QR (formulario público)
-- =========================================================================

-- 1. Campos nuevos en remitos para la firma digital
ALTER TABLE public.remitos
  ADD COLUMN IF NOT EXISTS firma_token TEXT,            -- token único para el QR
  ADD COLUMN IF NOT EXISTS firma_estado TEXT DEFAULT 'pendiente'
    CHECK (firma_estado IN ('pendiente', 'firmado')),
  ADD COLUMN IF NOT EXISTS firma_nombre TEXT,           -- nombre y apellido de quien recibe
  ADD COLUMN IF NOT EXISTS firma_dni TEXT,
  ADD COLUMN IF NOT EXISTS firma_imagen TEXT,           -- firma dibujada (dataURL base64)
  ADD COLUMN IF NOT EXISTS firma_fecha TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS firma_items_recibidos JSONB, -- {item_id: true/false}
  ADD COLUMN IF NOT EXISTS firma_observaciones TEXT;

-- Generar token para remitos existentes que no tengan
UPDATE public.remitos
SET firma_token = encode(gen_random_bytes(24), 'hex')
WHERE firma_token IS NULL;

-- Trigger para generar token automáticamente en remitos nuevos
CREATE OR REPLACE FUNCTION public.set_firma_token()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.firma_token IS NULL THEN
    NEW.firma_token := encode(gen_random_bytes(24), 'hex');
  END IF;
  IF NEW.firma_estado IS NULL THEN
    NEW.firma_estado := 'pendiente';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_firma_token ON public.remitos;
CREATE TRIGGER trg_set_firma_token
BEFORE INSERT ON public.remitos
FOR EACH ROW
EXECUTE FUNCTION public.set_firma_token();

-- 2. RPC pública: obtener datos del remito por token (SIN login)
-- Devuelve solo lo necesario para mostrar el formulario de firma.
CREATE OR REPLACE FUNCTION public.get_remito_para_firma(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remito RECORD;
  v_items JSONB;
  v_cliente_nombre TEXT;
  v_obra_codigo TEXT;
BEGIN
  SELECT * INTO v_remito FROM public.remitos WHERE firma_token = p_token;
  IF v_remito IS NULL THEN
    RETURN jsonb_build_object('error', 'Remito no encontrado');
  END IF;

  -- Cliente
  SELECT nombre INTO v_cliente_nombre FROM public.clientes WHERE id = v_remito.cliente_id;
  -- Obra
  SELECT obra_id INTO v_obra_codigo FROM public.obras WHERE id = v_remito.obra_id;

  -- Items
  SELECT jsonb_agg(jsonb_build_object(
    'id', ri.id,
    'descripcion', COALESCE(i.descripcion, ri.descripcion_libre, '—'),
    'cantidad', ri.cantidad,
    'unidad', COALESCE(ri.unidad, i.unidad, 'ud.')
  ) ORDER BY ri.created_at)
  INTO v_items
  FROM public.remito_items ri
  LEFT JOIN public.inventario i ON i.id = ri.item_id
  WHERE ri.remito_id = v_remito.id;

  RETURN jsonb_build_object(
    'remito_id', v_remito.remito_id,
    'fecha', v_remito.fecha,
    'cliente', COALESCE(v_cliente_nombre, '—'),
    'obra', COALESCE(v_obra_codigo, '—'),
    'estado', v_remito.firma_estado,
    'firma_nombre', v_remito.firma_nombre,
    'firma_fecha', v_remito.firma_fecha,
    'items', COALESCE(v_items, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_remito_para_firma(TEXT) TO anon, authenticated;

-- 3. RPC pública: firmar el remito (SIN login)
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

  -- Validaciones básicas
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
      fecha_recepcion = NOW(),
      updated_at = NOW()
  WHERE firma_token = p_token;

  RETURN jsonb_build_object('ok', true, 'remito_id', v_remito.remito_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.firmar_remito(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT) TO anon, authenticated;

-- 4. RPC para resetear firma (solo usuarios autenticados con permiso)
CREATE OR REPLACE FUNCTION public.resetear_firma_remito(p_remito_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar permiso del usuario
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
      fecha_recepcion = NULL,
      updated_at = NOW()
  WHERE id = p_remito_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resetear_firma_remito(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
SELECT 'Migracion 047 completada — Firma digital de remitos' AS estado;
