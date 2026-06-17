-- =========================================================================
-- 057_caja_chica.sql
-- Módulo Caja Chica: gastos administrativos o de obra, con comprobante opcional.
-- Los gastos de obra se reflejan también en costos_extras_obra (centro de costos).
-- =========================================================================

-- 1. Tabla principal de caja chica
CREATE TABLE IF NOT EXISTS public.caja_chica (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('obra', 'administrativo')),
  obra_id UUID REFERENCES public.obras(id) ON DELETE SET NULL,
  categoria TEXT NOT NULL,           -- combustible, viaticos, materiales, etc.
  concepto TEXT NOT NULL,
  monto NUMERIC NOT NULL CHECK (monto >= 0),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  comprobante_url TEXT,              -- imagen/comprobante en storage (opcional)
  medio_pago TEXT,                   -- efectivo, transferencia, tarjeta (opcional)
  observaciones TEXT,
  costo_extra_id UUID REFERENCES public.costos_extras_obra(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.usuarios(id)
);

CREATE INDEX IF NOT EXISTS idx_caja_chica_fecha ON public.caja_chica(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_caja_chica_obra ON public.caja_chica(obra_id);
CREATE INDEX IF NOT EXISTS idx_caja_chica_tipo ON public.caja_chica(tipo);

-- 2. RLS: ven y editan Direccion, Operaciones, Contabilidad (técnicos NO)
ALTER TABLE public.caja_chica ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "caja_chica_select" ON public.caja_chica;
CREATE POLICY "caja_chica_select" ON public.caja_chica
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.usuarios
    WHERE id = auth.uid() AND area IN ('Direccion','Operaciones','Contabilidad') AND activo = true)
);

DROP POLICY IF EXISTS "caja_chica_insert" ON public.caja_chica;
CREATE POLICY "caja_chica_insert" ON public.caja_chica
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.usuarios
    WHERE id = auth.uid() AND area IN ('Direccion','Operaciones','Contabilidad') AND activo = true)
);

DROP POLICY IF EXISTS "caja_chica_update" ON public.caja_chica;
CREATE POLICY "caja_chica_update" ON public.caja_chica
FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.usuarios
    WHERE id = auth.uid() AND area IN ('Direccion','Operaciones','Contabilidad') AND activo = true)
);

DROP POLICY IF EXISTS "caja_chica_delete" ON public.caja_chica;
CREATE POLICY "caja_chica_delete" ON public.caja_chica
FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.usuarios
    WHERE id = auth.uid() AND area IN ('Direccion','Operaciones','Contabilidad') AND activo = true)
);

-- 3. Bucket de storage para comprobantes (si no existe)
INSERT INTO storage.buckets (id, name, public)
VALUES ('caja-chica', 'caja-chica', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage: usuarios autenticados con permiso suben/ven
DROP POLICY IF EXISTS "caja_chica_storage_select" ON storage.objects;
CREATE POLICY "caja_chica_storage_select" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'caja-chica');

DROP POLICY IF EXISTS "caja_chica_storage_insert" ON storage.objects;
CREATE POLICY "caja_chica_storage_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'caja-chica');

DROP POLICY IF EXISTS "caja_chica_storage_delete" ON storage.objects;
CREATE POLICY "caja_chica_storage_delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'caja-chica');

NOTIFY pgrst, 'reload schema';
SELECT 'Migracion 057 completada — Caja Chica' AS estado;
