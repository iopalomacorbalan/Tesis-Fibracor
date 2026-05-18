-- =========================================================================
-- 044_google_calendar.sql
-- Soporte para sincronización con Google Calendar
-- =========================================================================

-- 1. Columnas en obras para tracking del sync
ALTER TABLE public.obras
  ADD COLUMN IF NOT EXISTS google_event_id TEXT,
  ADD COLUMN IF NOT EXISTS google_last_sync TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS google_sync_error TEXT;

COMMENT ON COLUMN public.obras.google_event_id IS
  'ID del evento en Google Calendar (vacío si nunca se sincronizó)';
COMMENT ON COLUMN public.obras.google_last_sync IS
  'Última vez que se sincronizó con Google Calendar';
COMMENT ON COLUMN public.obras.google_sync_error IS
  'Mensaje de error si el último intento de sync falló';

-- 2. Tabla de log para auditar las sincronizaciones
CREATE TABLE IF NOT EXISTS public.google_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID REFERENCES public.obras(id) ON DELETE SET NULL,
  obra_codigo TEXT,
  accion TEXT NOT NULL, -- 'create', 'update', 'delete', 'resync_all'
  resultado TEXT NOT NULL, -- 'ok', 'error', 'skipped'
  google_event_id TEXT,
  error_msg TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_google_sync_log_obra ON public.google_sync_log(obra_id);
CREATE INDEX IF NOT EXISTS idx_google_sync_log_created ON public.google_sync_log(created_at DESC);

-- RLS - solo lectura para Direccion
ALTER TABLE public.google_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "direccion_ve_logs_google" ON public.google_sync_log;
CREATE POLICY "direccion_ve_logs_google"
ON public.google_sync_log FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid() AND area = 'Direccion' AND activo = true
  )
);

-- 3. Tabla de configuración para guardar Calendar ID (no se guarda el JSON acá,
--    eso va en Supabase secrets, pero el calendar_id sí puede estar visible)
CREATE TABLE IF NOT EXISTS public.google_calendar_config (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  calendar_id TEXT,
  habilitado BOOLEAN DEFAULT false,
  zona_horaria TEXT DEFAULT 'America/Argentina/Buenos_Aires',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (id = 1) -- solo permite 1 fila
);

INSERT INTO public.google_calendar_config (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.google_calendar_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "todos_ven_config_google" ON public.google_calendar_config;
CREATE POLICY "todos_ven_config_google"
ON public.google_calendar_config FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "direccion_edita_config_google" ON public.google_calendar_config;
CREATE POLICY "direccion_edita_config_google"
ON public.google_calendar_config FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid() AND area = 'Direccion' AND activo = true
  )
);

-- 4. Función pg_net para llamar a la Edge Function cuando hay cambios
-- (instalamos la extensión si no existe)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 5. Función trigger: notifica a la Edge Function cuando una obra cambia
CREATE OR REPLACE FUNCTION public.notificar_google_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_habilitado BOOLEAN;
  v_accion TEXT;
  v_obra_id UUID;
  v_supabase_url TEXT;
  v_anon_key TEXT;
BEGIN
  -- Solo si está habilitado
  SELECT habilitado INTO v_habilitado
  FROM public.google_calendar_config WHERE id = 1;
  IF NOT v_habilitado THEN RETURN COALESCE(NEW, OLD); END IF;

  -- Determinar acción
  IF TG_OP = 'INSERT' THEN
    v_accion := 'create';
    v_obra_id := NEW.id;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Solo sincronizar si cambió algo relevante para el evento
    IF (NEW.nombre_obra IS DISTINCT FROM OLD.nombre_obra)
       OR (NEW.fecha_inicio_est IS DISTINCT FROM OLD.fecha_inicio_est)
       OR (NEW.fecha_fin_est IS DISTINCT FROM OLD.fecha_fin_est)
       OR (NEW.fecha_inicio_real IS DISTINCT FROM OLD.fecha_inicio_real)
       OR (NEW.fecha_fin_real IS DISTINCT FROM OLD.fecha_fin_real)
       OR (NEW.estado IS DISTINCT FROM OLD.estado)
       OR (NEW.descripcion IS DISTINCT FROM OLD.descripcion)
       OR (NEW.direccion IS DISTINCT FROM OLD.direccion)
    THEN
      v_accion := 'update';
      v_obra_id := NEW.id;
    ELSE
      RETURN NEW; -- no sincronizar si solo cambiaron campos irrelevantes
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_accion := 'delete';
    v_obra_id := OLD.id;
  END IF;

  -- Llamar a la Edge Function de forma asíncrona
  -- (la URL y key se setean por separado abajo)
  BEGIN
    v_supabase_url := current_setting('app.supabase_url', true);
    v_anon_key := current_setting('app.supabase_anon_key', true);

    IF v_supabase_url IS NOT NULL AND v_anon_key IS NOT NULL THEN
      PERFORM net.http_post(
        url := v_supabase_url || '/functions/v1/sync-google-calendar',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_anon_key
        ),
        body := jsonb_build_object('obra_id', v_obra_id, 'accion', v_accion)
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Si falla la llamada, log pero no rompemos el insert/update/delete
    INSERT INTO public.google_sync_log (obra_id, accion, resultado, error_msg)
    VALUES (v_obra_id, v_accion, 'error', 'Error al llamar edge function: ' || SQLERRM);
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 6. Crear los triggers
DROP TRIGGER IF EXISTS trg_obras_google_sync_iud ON public.obras;
CREATE TRIGGER trg_obras_google_sync_iud
AFTER INSERT OR UPDATE OR DELETE ON public.obras
FOR EACH ROW
EXECUTE FUNCTION public.notificar_google_sync();

-- 7. NOTA: Los siguientes valores hay que setearlos en Supabase Dashboard
-- → Database → Settings → Custom Parameters:
--   app.supabase_url = 'https://vijqobgrikempdtdgafz.supabase.co'
--   app.supabase_anon_key = '<tu anon key>'
-- ALTERNATIVAMENTE, podemos hardcodearlos pero es menos seguro

NOTIFY pgrst, 'reload schema';
SELECT 'Migracion 044 completada — Google Calendar BD lista' AS estado;
