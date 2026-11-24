-- =========================================================================
-- 071_calendario_enlaces.sql
-- Enlaces de calendario (iCal) para suscribirse desde Google Calendar, Outlook o el celular:
--   - un enlace PERSONAL por usuario: sus obras asignadas (como técnico o jefe de obra)
--   - un enlace CENTRAL: qué obra tiene cada técnico y en qué fechas
-- No necesita cuenta de Google Cloud. El enlace lo sirve la Edge Function calendario-ics.
-- No borra ni modifica datos existentes.
-- =========================================================================

-- El enlace es un secreto (quien lo tiene ve ese calendario): la tabla tiene RLS activado SIN
-- políticas, así que ningún usuario de la app puede leerla. Solo las funciones de abajo y la
-- Edge Function (service role) la usan.
CREATE TABLE IF NOT EXISTS public.calendario_enlaces (
  token       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID UNIQUE REFERENCES public.usuarios(id) ON DELETE CASCADE,  -- NULL = enlace central
  central     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((central AND usuario_id IS NULL) OR (NOT central AND usuario_id IS NOT NULL))
);
-- Un solo enlace central
CREATE UNIQUE INDEX IF NOT EXISTS uq_calendario_enlace_central
  ON public.calendario_enlaces (central) WHERE central;

ALTER TABLE public.calendario_enlaces ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.calendario_enlaces FROM anon, authenticated;

-- Mi enlace personal (se crea la primera vez que lo pido)
CREATE OR REPLACE FUNCTION public.mi_enlace_calendario()
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_token UUID;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND activo = true
  ) THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;

  SELECT token INTO v_token FROM public.calendario_enlaces WHERE usuario_id = auth.uid();
  IF v_token IS NULL THEN
    INSERT INTO public.calendario_enlaces (usuario_id) VALUES (auth.uid()) RETURNING token INTO v_token;
  END IF;
  RETURN v_token;
END;
$$;

-- Si el enlace se filtró: invalida el anterior y crea uno nuevo
CREATE OR REPLACE FUNCTION public.regenerar_enlace_calendario()
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_token UUID;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND activo = true
  ) THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;

  DELETE FROM public.calendario_enlaces WHERE usuario_id = auth.uid();
  INSERT INTO public.calendario_enlaces (usuario_id) VALUES (auth.uid()) RETURNING token INTO v_token;
  RETURN v_token;
END;
$$;

-- Enlace del calendario central (Dirección, Operaciones y Contabilidad)
CREATE OR REPLACE FUNCTION public.enlace_calendario_central(p_regenerar BOOLEAN DEFAULT FALSE)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_token UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid() AND area IN ('Direccion', 'Operaciones', 'Contabilidad') AND activo = true
  ) THEN
    RAISE EXCEPTION 'Sin permiso';
  END IF;

  IF p_regenerar THEN
    DELETE FROM public.calendario_enlaces WHERE central;
  END IF;
  SELECT token INTO v_token FROM public.calendario_enlaces WHERE central;
  IF v_token IS NULL THEN
    INSERT INTO public.calendario_enlaces (central) VALUES (TRUE) RETURNING token INTO v_token;
  END IF;
  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.mi_enlace_calendario() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.regenerar_enlace_calendario() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enlace_calendario_central(BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mi_enlace_calendario() TO authenticated;
GRANT EXECUTE ON FUNCTION public.regenerar_enlace_calendario() TO authenticated;
GRANT EXECUTE ON FUNCTION public.enlace_calendario_central(BOOLEAN) TO authenticated;

NOTIFY pgrst, 'reload schema';
SELECT 'Migracion 071 completada — enlaces de calendario' AS estado;
