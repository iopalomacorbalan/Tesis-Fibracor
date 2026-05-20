-- =========================================================================
-- 045_cliente_recomendaciones.sql
-- Perfil de recomendaciones/políticas por cliente
-- =========================================================================

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS recomendaciones TEXT,
  ADD COLUMN IF NOT EXISTS recomendaciones_prioridad TEXT
    CHECK (recomendaciones_prioridad IN ('normal', 'importante', 'critico'));

COMMENT ON COLUMN public.clientes.recomendaciones IS
  'Políticas y recomendaciones de cómo manejarse con este cliente (visible para técnicos en obras)';
COMMENT ON COLUMN public.clientes.recomendaciones_prioridad IS
  'Nivel de importancia: normal / importante / critico';

NOTIFY pgrst, 'reload schema';
SELECT 'Migracion 045 completada — Recomendaciones de cliente' AS estado;
