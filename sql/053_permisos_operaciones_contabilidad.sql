-- =========================================================================
-- 053_permisos_operaciones_contabilidad.sql
-- Operaciones y Contabilidad obtienen los mismos permisos que Direccion
-- en las políticas RLS y funciones que solo permitían a Direccion.
-- =========================================================================

-- 1. Logs de Google Calendar: ahora también Operaciones y Contabilidad
DROP POLICY IF EXISTS "direccion_ve_logs_google" ON public.google_sync_log;
CREATE POLICY "direccion_ve_logs_google"
ON public.google_sync_log FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid()
      AND area IN ('Direccion', 'Operaciones', 'Contabilidad')
      AND activo = true
  )
);

-- 2. Config de Google Calendar: editar también Operaciones y Contabilidad
DROP POLICY IF EXISTS "direccion_edita_config_google" ON public.google_calendar_config;
CREATE POLICY "direccion_edita_config_google"
ON public.google_calendar_config FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid()
      AND area IN ('Direccion', 'Operaciones', 'Contabilidad')
      AND activo = true
  )
);

-- 3. Resetear firma de remito: agregar Contabilidad
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
      AND area IN ('Direccion', 'Operaciones', 'Comercial', 'Paniol', 'Contabilidad')
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
SELECT 'Migracion 053 completada — permisos igualados' AS estado;
