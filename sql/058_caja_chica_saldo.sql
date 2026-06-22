-- =========================================================================
-- 058_caja_chica_saldo.sql
-- Saldo de caja chica: movimientos de ingreso/ajuste + flag de descuento en gastos.
-- =========================================================================

-- 1. Flag en gastos: ¿descuenta del saldo de caja chica?
ALTER TABLE public.caja_chica
  ADD COLUMN IF NOT EXISTS descuenta_caja BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.caja_chica.descuenta_caja IS
  'Si true, el gasto resta del saldo disponible de caja chica';

-- 2. Tabla de movimientos de caja (ingresos / ajustes de saldo)
CREATE TABLE IF NOT EXISTS public.caja_chica_movimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('ingreso', 'ajuste')),
  monto NUMERIC NOT NULL,           -- ingreso: positivo; ajuste: el nuevo saldo objetivo
  concepto TEXT,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.usuarios(id)
);

CREATE INDEX IF NOT EXISTS idx_caja_mov_fecha ON public.caja_chica_movimientos(fecha DESC);

ALTER TABLE public.caja_chica_movimientos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "caja_mov_select" ON public.caja_chica_movimientos;
CREATE POLICY "caja_mov_select" ON public.caja_chica_movimientos
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.usuarios
  WHERE id = auth.uid() AND area IN ('Direccion','Operaciones','Contabilidad') AND activo = true));

DROP POLICY IF EXISTS "caja_mov_insert" ON public.caja_chica_movimientos;
CREATE POLICY "caja_mov_insert" ON public.caja_chica_movimientos
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios
  WHERE id = auth.uid() AND area IN ('Direccion','Operaciones','Contabilidad') AND activo = true));

DROP POLICY IF EXISTS "caja_mov_delete" ON public.caja_chica_movimientos;
CREATE POLICY "caja_mov_delete" ON public.caja_chica_movimientos
FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.usuarios
  WHERE id = auth.uid() AND area IN ('Direccion','Operaciones','Contabilidad') AND activo = true));

-- 3. RPC para calcular el saldo actual
-- Saldo = (suma de ingresos) - (suma de gastos que descuentan) ± ajustes
-- Para los ajustes: cada ajuste "fija" el saldo a un valor en su fecha. Tomamos el
-- último ajuste como punto de partida y sumamos ingresos/restamos gastos posteriores.
CREATE OR REPLACE FUNCTION public.get_saldo_caja_chica()
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ultimo_ajuste RECORD;
  v_saldo NUMERIC := 0;
  v_fecha_base TIMESTAMPTZ := '1900-01-01';
BEGIN
  -- Buscar el último ajuste (fija el saldo en un momento dado)
  SELECT monto, created_at INTO v_ultimo_ajuste
  FROM public.caja_chica_movimientos
  WHERE tipo = 'ajuste'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_ultimo_ajuste IS NOT NULL THEN
    v_saldo := v_ultimo_ajuste.monto;
    v_fecha_base := v_ultimo_ajuste.created_at;
  END IF;

  -- Sumar ingresos posteriores al ajuste base
  v_saldo := v_saldo + COALESCE((
    SELECT SUM(monto) FROM public.caja_chica_movimientos
    WHERE tipo = 'ingreso' AND created_at > v_fecha_base
  ), 0);

  -- Restar gastos (que descuentan) posteriores al ajuste base
  v_saldo := v_saldo - COALESCE((
    SELECT SUM(monto) FROM public.caja_chica
    WHERE descuenta_caja = true AND created_at > v_fecha_base
  ), 0);

  RETURN v_saldo;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_saldo_caja_chica() TO authenticated;

NOTIFY pgrst, 'reload schema';
SELECT 'Migracion 058 completada — Saldo de caja chica' AS estado;
