-- =========================================================================
-- 050_codigo_barras.sql
-- Campo de código de barras en inventario para lectora Honeywell
-- =========================================================================

ALTER TABLE public.inventario
  ADD COLUMN IF NOT EXISTS codigo_barras TEXT;

COMMENT ON COLUMN public.inventario.codigo_barras IS
  'Código de barras del producto (EAN/UPC de fábrica o código propio). Usado con lectora.';

-- Índice para búsqueda rápida por código de barras
CREATE INDEX IF NOT EXISTS idx_inventario_codigo_barras
  ON public.inventario(codigo_barras)
  WHERE codigo_barras IS NOT NULL;

NOTIFY pgrst, 'reload schema';
SELECT 'Migracion 050 completada — Código de barras en inventario' AS estado;
