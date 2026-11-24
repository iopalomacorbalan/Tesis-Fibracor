-- =========================================================================
-- 072_quitar_sync_google_central.sql
-- Quita la sincronización automática vieja con el calendario central de Google
-- (cuenta de servicio), reemplazada por los enlaces de calendario (071).
-- Borra SOLO el disparador y su función. Las tablas google_calendar_config y
-- google_sync_log (y las columnas google_* de obras) quedan intactas: no se pierde nada.
-- =========================================================================

DROP TRIGGER IF EXISTS trg_obras_google_sync_iud ON public.obras;
DROP FUNCTION IF EXISTS public.notificar_google_sync();

SELECT 'Migracion 072 completada — sync Google central vieja desactivada' AS estado;
