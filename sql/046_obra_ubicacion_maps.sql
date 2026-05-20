-- =========================================================================
-- 046_obra_ubicacion_maps.sql
-- Link de Google Maps opcional en obras
-- =========================================================================

ALTER TABLE public.obras
  ADD COLUMN IF NOT EXISTS maps_url TEXT;

COMMENT ON COLUMN public.obras.maps_url IS
  'Link de Google Maps de la ubicación de la obra (opcional, para que los técnicos puedan navegar)';

NOTIFY pgrst, 'reload schema';
SELECT 'Migracion 046 completada — Ubicación Maps en obras' AS estado;
