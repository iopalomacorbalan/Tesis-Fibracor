-- =========================================================================
-- 066_catalogo_unidades.sql
-- Limita la unidad a un catálogo fijo en inventario y remito_items.
-- NOT VALID: no revisa los datos viejos, pero controla todo lo nuevo.
-- Primero correr el SELECT de diagnóstico para ver si hay valores fuera del catálogo.
-- =========================================================================

-- Diagnóstico (solo lectura): unidades fuera del catálogo
SELECT 'inventario' AS tabla, unidad, COUNT(*) FROM public.inventario
  WHERE unidad NOT IN ('ud.','m','km','kg','lt','caja','rollo','bolsa','par') GROUP BY unidad
UNION ALL
SELECT 'remito_items', unidad, COUNT(*) FROM public.remito_items
  WHERE unidad IS NOT NULL AND unidad NOT IN ('ud.','m','km','kg','lt','caja','rollo','bolsa','par') GROUP BY unidad;

ALTER TABLE public.inventario DROP CONSTRAINT IF EXISTS inventario_unidad_catalogo;
ALTER TABLE public.inventario ADD CONSTRAINT inventario_unidad_catalogo
  CHECK (unidad IN ('ud.','m','km','kg','lt','caja','rollo','bolsa','par')) NOT VALID;

ALTER TABLE public.remito_items DROP CONSTRAINT IF EXISTS remito_items_unidad_catalogo;
ALTER TABLE public.remito_items ADD CONSTRAINT remito_items_unidad_catalogo
  CHECK (unidad IS NULL OR unidad IN ('ud.','m','km','kg','lt','caja','rollo','bolsa','par')) NOT VALID;

NOTIFY pgrst, 'reload schema';
SELECT 'Migracion 066 completada — catalogo de unidades' AS estado;
