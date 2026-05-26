-- =========================================================================
-- 051_compra_moneda.sql
-- Tipo de moneda en órdenes de compra (ARS / USD)
-- =========================================================================

ALTER TABLE public.compras
  ADD COLUMN IF NOT EXISTS moneda TEXT DEFAULT 'ARS'
    CHECK (moneda IN ('ARS', 'USD'));

COMMENT ON COLUMN public.compras.moneda IS
  'Moneda de la orden de compra: ARS (pesos) o USD (dólares)';

-- Las OC existentes quedan en ARS por defecto
UPDATE public.compras SET moneda = 'ARS' WHERE moneda IS NULL;

NOTIFY pgrst, 'reload schema';
SELECT 'Migracion 051 completada — Moneda en órdenes de compra' AS estado;
