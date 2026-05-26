-- =========================================================================
-- 048_fix_get_remito_firma.sql
-- Corrige el ORDER BY (remito_items no tiene created_at)
-- =========================================================================

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

  SELECT nombre INTO v_cliente_nombre FROM public.clientes WHERE id = v_remito.cliente_id;
  SELECT obra_id INTO v_obra_codigo FROM public.obras WHERE id = v_remito.obra_id;

  -- Items (ordenados por id, no por created_at que no existe)
  SELECT jsonb_agg(jsonb_build_object(
    'id', ri.id,
    'descripcion', COALESCE(i.descripcion, ri.descripcion_libre, '—'),
    'cantidad', ri.cantidad,
    'unidad', COALESCE(ri.unidad, i.unidad, 'ud.')
  ) ORDER BY ri.id)
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
GRANT EXECUTE ON FUNCTION public.firmar_remito(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
SELECT 'Migracion 048 completada — RPC firma corregida' AS estado;
