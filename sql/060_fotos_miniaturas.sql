-- =========================================================================
-- 060_fotos_miniaturas.sql
-- Agrega miniatura (thumbnail) a las fotos de reportes.
-- La miniatura (~300px, ~20KB) se usa en grillas y overview; la original
-- solo se carga al ampliar la foto.
-- =========================================================================

ALTER TABLE public.reporte_fotos
  ADD COLUMN IF NOT EXISTS thumb_url TEXT,
  ADD COLUMN IF NOT EXISTS thumb_path TEXT;

COMMENT ON COLUMN public.reporte_fotos.thumb_url IS
  'URL pública de la miniatura (~300px). Si es NULL, se usa url (original).';
COMMENT ON COLUMN public.reporte_fotos.thumb_path IS
  'Path en storage de la miniatura, para poder borrarla junto con la foto.';

-- Índice para poder listar rápido las fotos que aún no tienen miniatura
-- (lo usa el script de migración)
CREATE INDEX IF NOT EXISTS idx_reporte_fotos_sin_thumb
  ON public.reporte_fotos(id) WHERE thumb_url IS NULL;

NOTIFY pgrst, 'reload schema';

-- Diagnóstico: cuántas fotos hay y cuántas tienen miniatura
SELECT
  COUNT(*)                                   AS total_fotos,
  COUNT(thumb_url)                           AS con_miniatura,
  COUNT(*) - COUNT(thumb_url)                AS pendientes_de_migrar
FROM public.reporte_fotos;

SELECT 'Migracion 060 completada — Miniaturas de fotos' AS estado;
