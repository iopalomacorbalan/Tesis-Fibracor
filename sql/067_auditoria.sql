-- =========================================================================
-- 067_auditoria.sql
-- Tabla de auditoría + trigger genérico. Registra quién creó, modificó o borró
-- registros de las tablas clave. Solo Dirección puede consultarla.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.auditoria (
  id BIGSERIAL PRIMARY KEY,
  tabla TEXT NOT NULL,
  registro_id TEXT,                 -- id del registro afectado
  referencia TEXT,                  -- código legible (OBR-..., REM-..., etc.) si existe
  accion TEXT NOT NULL CHECK (accion IN ('INSERT', 'UPDATE', 'DELETE')),
  usuario_id UUID,                  -- NULL = sistema / sin sesión
  usuario_nombre TEXT,
  cambios JSONB,                    -- UPDATE: {campo: {antes, despues}} · INSERT/DELETE: fila completa
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON public.auditoria(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_tabla ON public.auditoria(tabla, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON public.auditoria(usuario_id, created_at DESC);

-- RLS: solo Dirección lee. Nadie escribe directo (lo hace el trigger, SECURITY DEFINER).
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auditoria_solo_direccion" ON public.auditoria;
CREATE POLICY "auditoria_solo_direccion" ON public.auditoria FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.usuarios u
  WHERE u.id = auth.uid() AND u.area = 'Direccion' AND u.activo = true
));

-- Trigger genérico
CREATE OR REPLACE FUNCTION public.auditar_cambio()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old JSONB;
  v_new JSONB;
  v_fila JSONB;
  v_cambios JSONB := '{}'::jsonb;
  v_clave TEXT;
  -- columnas que no aportan o son pesadas
  v_ignorar TEXT[] := ARRAY['updated_at', 'firma_imagen', 'firma_token'];
  v_nombre TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_fila := to_jsonb(OLD);
  ELSE
    v_fila := to_jsonb(NEW);
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    FOR v_clave IN SELECT jsonb_object_keys(v_new) LOOP
      IF v_clave = ANY (v_ignorar) THEN CONTINUE; END IF;
      IF v_old -> v_clave IS DISTINCT FROM v_new -> v_clave THEN
        v_cambios := v_cambios || jsonb_build_object(
          v_clave, jsonb_build_object('antes', v_old -> v_clave, 'despues', v_new -> v_clave)
        );
      END IF;
    END LOOP;
    IF v_cambios = '{}'::jsonb THEN RETURN NEW; END IF;  -- nada relevante cambió
  ELSE
    v_cambios := v_fila - v_ignorar;
  END IF;

  SELECT nombre INTO v_nombre FROM public.usuarios WHERE id = auth.uid();

  INSERT INTO public.auditoria (tabla, registro_id, referencia, accion, usuario_id, usuario_nombre, cambios)
  VALUES (
    TG_TABLE_NAME,
    v_fila ->> 'id',
    COALESCE(CASE WHEN TG_TABLE_NAME = 'obras' THEN v_fila ->> 'obra_id' END, v_fila ->> 'remito_id', v_fila ->> 'compra_id',
             v_fila ->> 'item_id', v_fila ->> 'nombre', v_fila ->> 'email'),
    TG_OP,
    auth.uid(),
    v_nombre,
    v_cambios
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- Activar en las tablas clave (solo si existen)
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['obras', 'remitos', 'compras', 'inventario', 'caja_chica',
                           'clientes', 'proveedores', 'usuarios']
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_auditoria ON public.%I', t);
      EXECUTE format(
        'CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.auditar_cambio()', t);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
SELECT 'Migracion 067 completada — auditoria' AS estado;
