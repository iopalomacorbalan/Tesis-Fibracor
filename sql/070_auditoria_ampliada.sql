-- =========================================================================
-- 070_auditoria_ampliada.sql
-- Amplía la auditoría (067) con dos entidades principales más, REPORTES y SOLICITUDES, y hace que
-- cada movimiento se pueda leer con sentido.
--
-- Se audita lo que una persona reconoce como "una cosa": obra, reporte, solicitud, remito,
-- compra, ítem de stock, caja chica, cliente, proveedor y usuario.
-- NO se audita el detalle interno (asistencias, fotos, ítems de un remito o de una compra,
-- movimientos de stock, etc.): son partes de las cosas de arriba y solo harían ruido.
--
--   1) Nueva columna auditoria.contexto: guarda, en palabras, a qué obra, técnico, cliente, etc.
--      pertenece cada movimiento (en vez de solo ids internos).
--   2) auditar_cambio() arma ese contexto y un código legible (OBR-..., REP-..., SOL-...).
--      Si algo falla al armar el contexto, el registro se guarda igual: la auditoría nunca
--      bloquea la operación original.
--   3) El trigger queda instalado SOLO en las tablas de la lista de abajo, y se quita de las demás.
--
-- Requiere haber corrido antes el 067. No modifica ni borra datos. Se puede correr varias veces.
-- =========================================================================

ALTER TABLE public.auditoria ADD COLUMN IF NOT EXISTS contexto JSONB;

-- Nombre legible de un registro referenciado por su id interno (uuid)
CREATE OR REPLACE FUNCTION public.auditar_etiqueta(p_tipo TEXT, p_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v TEXT;
BEGIN
  CASE p_tipo
    WHEN 'obra'       THEN SELECT o.obra_id || COALESCE(' · ' || o.nombre_obra, '') INTO v FROM public.obras o WHERE o.id = p_id;
    WHEN 'reporte'    THEN SELECT r.reporte_id INTO v FROM public.reportes r WHERE r.id = p_id;
    WHEN 'solicitud'  THEN SELECT s.solicitud_id INTO v FROM public.solicitudes s WHERE s.id = p_id;
    WHEN 'remito'     THEN SELECT r.remito_id INTO v FROM public.remitos r WHERE r.id = p_id;
    WHEN 'compra'     THEN SELECT c.compra_id INTO v FROM public.compras c WHERE c.id = p_id;
    WHEN 'item'       THEN SELECT i.item_id || COALESCE(' · ' || i.descripcion, '') INTO v FROM public.inventario i WHERE i.id = p_id;
    WHEN 'usuario'    THEN SELECT u.nombre INTO v FROM public.usuarios u WHERE u.id = p_id;
    WHEN 'cliente'    THEN SELECT c.nombre INTO v FROM public.clientes c WHERE c.id = p_id;
    WHEN 'proveedor'  THEN SELECT p.nombre INTO v FROM public.proveedores p WHERE p.id = p_id;
    ELSE v := NULL;
  END CASE;
  RETURN v;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- Solo la usa el trigger: nadie debe poder llamarla desde la API para averiguar nombres saltándose los permisos
REVOKE ALL ON FUNCTION public.auditar_etiqueta(TEXT, UUID) FROM PUBLIC, anon, authenticated;

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
  v_ctx JSONB := '{}'::jsonb;
  v_clave TEXT;
  v_valor TEXT;
  v_txt TEXT;
  v_par JSONB;
  v_ref TEXT;
  v_nombre TEXT;
  -- columnas que no aportan o son pesadas
  v_ignorar TEXT[] := ARRAY['updated_at', 'firma_imagen', 'firma_token'];
  -- campos que, si no son un uuid, sirven como código o nombre legible del registro (en este orden)
  v_campos_ref TEXT[] := ARRAY['obra_id', 'reporte_id', 'solicitud_id', 'remito_id', 'compra_id',
                               'item_id', 'nombre', 'descripcion', 'email'];
  -- columna con id interno -> [qué es, cómo se llama en el detalle]
  v_mapa JSONB := '{
    "obra_id": ["obra", "Obra"], "reporte_id": ["reporte", "Reporte"], "solicitud_id": ["solicitud", "Solicitud"],
    "remito_id": ["remito", "Remito"], "compra_id": ["compra", "Compra"], "item_id": ["item", "Ítem"],
    "cliente_id": ["cliente", "Cliente"], "proveedor_id": ["proveedor", "Proveedor"],
    "proveedor_principal_id": ["proveedor", "Proveedor"], "tecnico_id": ["usuario", "Técnico"],
    "jefe_obra_id": ["usuario", "Jefe de obra"], "destinatario_id": ["usuario", "Destinatario"],
    "solicitado_por": ["usuario", "Solicitado por"]
  }'::jsonb;
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

  -- Código legible propio: el primer campo de la lista que tenga valor y no sea un uuid
  FOREACH v_clave IN ARRAY v_campos_ref LOOP
    v_valor := v_fila ->> v_clave;
    IF v_valor IS NOT NULL AND btrim(v_valor) <> ''
       AND v_valor !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      v_ref := v_valor;
      EXIT;
    END IF;
  END LOOP;

  -- Contexto en palabras: a qué obra, técnico, cliente… pertenece. Nunca debe frenar la operación.
  BEGIN
    FOR v_clave, v_par IN SELECT key, value FROM jsonb_each(v_mapa) LOOP
      v_valor := v_fila ->> v_clave;
      IF v_valor ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        v_txt := public.auditar_etiqueta(v_par ->> 0, v_valor::uuid);
        IF v_txt IS NOT NULL THEN
          v_ctx := v_ctx || jsonb_build_object(v_par ->> 1, v_txt);
        END IF;
      END IF;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    v_ctx := '{}'::jsonb;
  END;

  SELECT nombre INTO v_nombre FROM public.usuarios WHERE id = auth.uid();

  INSERT INTO public.auditoria (tabla, registro_id, referencia, accion, usuario_id, usuario_nombre, cambios, contexto)
  VALUES (TG_TABLE_NAME, v_fila ->> 'id', v_ref, TG_OP, auth.uid(), v_nombre, v_cambios,
          NULLIF(v_ctx, '{}'::jsonb));

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- Tablas auditadas: instalar el trigger en estas y quitarlo de todas las demás
DO $$
DECLARE
  t TEXT;
  v_auditadas TEXT[] := ARRAY['obras', 'reportes', 'solicitudes', 'remitos', 'compras',
                              'inventario', 'caja_chica', 'clientes', 'proveedores', 'usuarios'];
BEGIN
  FOR t IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> 'auditoria'
    ORDER BY table_name
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_auditoria ON public.%I', t);
    IF t = ANY (v_auditadas) THEN
      EXECUTE format(
        'CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.auditar_cambio()', t);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
SELECT 'Migracion 070 completada — auditoria ampliada' AS estado,
       (SELECT COUNT(*) FROM pg_trigger WHERE tgname = 'trg_auditoria' AND NOT tgisinternal) AS tablas_auditadas;
