-- =========================================================================
-- 068_rubros.sql
-- Rubros de proveedores en tablas (antes: proveedores.rubros TEXT[] con texto libre).
--   rubros             -> catálogo, cada rubro existe una sola vez (sin importar mayúsculas)
--   proveedor_rubros   -> qué rubros provee cada proveedor (N:M)
-- La columna proveedores.rubros NO se borra acá: queda sin uso y se elimina
-- después de desplegar la app (ver PASAR_A_PRODUCCION.md).
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.rubros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_rubros_nombre ON public.rubros (LOWER(TRIM(nombre)));

CREATE TABLE IF NOT EXISTS public.proveedor_rubros (
  proveedor_id UUID NOT NULL REFERENCES public.proveedores(id) ON DELETE CASCADE,
  rubro_id UUID NOT NULL REFERENCES public.rubros(id) ON DELETE RESTRICT,
  PRIMARY KEY (proveedor_id, rubro_id)
);
CREATE INDEX IF NOT EXISTS idx_proveedor_rubros_rubro ON public.proveedor_rubros(rubro_id);

-- RLS: lectura para todos los usuarios logueados; la escritura va solo por la función de abajo
ALTER TABLE public.rubros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proveedor_rubros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rubros_select" ON public.rubros;
CREATE POLICY "rubros_select" ON public.rubros FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "proveedor_rubros_select" ON public.proveedor_rubros;
CREATE POLICY "proveedor_rubros_select" ON public.proveedor_rubros FOR SELECT TO authenticated USING (true);

-- Cargar los rubros que ya existen (unificando mayúsculas y espacios)
INSERT INTO public.rubros (nombre)
SELECT DISTINCT ON (LOWER(TRIM(r))) TRIM(r)
FROM public.proveedores p, UNNEST(p.rubros) AS r
WHERE p.rubros IS NOT NULL AND TRIM(r) <> ''
ORDER BY LOWER(TRIM(r)), TRIM(r)
ON CONFLICT DO NOTHING;

-- Y los rubros sugeridos de siempre, para que estén aunque nadie los use todavía
INSERT INTO public.rubros (nombre) VALUES
  ('Fibra óptica'), ('Cobre / UTP'), ('Herramientas'), ('Equipamiento de red'),
  ('Materiales eléctricos'), ('Servicios'), ('Insumos generales'), ('Logística')
ON CONFLICT DO NOTHING;

-- Vincular cada proveedor con sus rubros
INSERT INTO public.proveedor_rubros (proveedor_id, rubro_id)
SELECT DISTINCT p.id, ru.id
FROM public.proveedores p
CROSS JOIN LATERAL UNNEST(p.rubros) AS r
JOIN public.rubros ru ON LOWER(TRIM(ru.nombre)) = LOWER(TRIM(r))
WHERE p.rubros IS NOT NULL
ON CONFLICT DO NOTHING;

-- Guardar los rubros de un proveedor: crea los que no existen y reemplaza el vínculo
CREATE OR REPLACE FUNCTION public.set_rubros_proveedor(p_proveedor_id UUID, p_rubros TEXT[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nombre TEXT;
  v_rubro_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid() AND activo = true
      AND area IN ('Direccion', 'Operaciones', 'Comercial', 'Contabilidad')
  ) THEN
    RAISE EXCEPTION 'No tenés permiso para editar rubros de proveedores';
  END IF;

  DELETE FROM public.proveedor_rubros WHERE proveedor_id = p_proveedor_id;

  FOREACH v_nombre IN ARRAY COALESCE(p_rubros, ARRAY[]::TEXT[]) LOOP
    v_nombre := TRIM(v_nombre);
    CONTINUE WHEN v_nombre = '';

    SELECT id INTO v_rubro_id FROM public.rubros WHERE LOWER(TRIM(nombre)) = LOWER(v_nombre);
    IF v_rubro_id IS NULL THEN
      INSERT INTO public.rubros (nombre) VALUES (v_nombre) RETURNING id INTO v_rubro_id;
    END IF;

    INSERT INTO public.proveedor_rubros (proveedor_id, rubro_id)
    VALUES (p_proveedor_id, v_rubro_id)
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_rubros_proveedor(UUID, TEXT[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
SELECT 'Migracion 068 completada — rubros' AS estado,
       (SELECT COUNT(*) FROM public.rubros) AS rubros,
       (SELECT COUNT(*) FROM public.proveedor_rubros) AS vinculos;
