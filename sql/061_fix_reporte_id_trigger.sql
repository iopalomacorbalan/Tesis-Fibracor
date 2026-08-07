-- =========================================================================
-- 061_fix_reporte_id_trigger.sql
-- Arregla el error "duplicate key value violates unique constraint
-- reportes_reporte_id_key".
--
-- Causa: el código REP-XXX lo generaba el frontend (leer max + 1), lo que
-- produce choques cuando dos técnicos crean un reporte al mismo tiempo.
--
-- Solución: generarlo en un trigger BEFORE INSERT dentro de la transacción,
-- con reintento — igual que ya se hace con movimientos, compras, etc.
-- =========================================================================

-- Función que asigna el reporte_id si no viene seteado
CREATE OR REPLACE FUNCTION public.set_reporte_id() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_next_n int;
  v_attempt int := 0;
BEGIN
  IF NEW.reporte_id IS NULL OR NEW.reporte_id = '' THEN
    LOOP
      v_attempt := v_attempt + 1;
      SELECT COALESCE(MAX(NULLIF(REGEXP_REPLACE(reporte_id, '[^0-9]', '', 'g'), '')::int), 0) + 1
      INTO v_next_n
      FROM public.reportes;
      NEW.reporte_id := 'REP-' || LPAD(v_next_n::text, 3, '0');
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.reportes WHERE reporte_id = NEW.reporte_id
      );
      IF v_attempt >= 10 THEN
        RAISE EXCEPTION 'No se pudo generar un reporte_id único';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

-- Crear el trigger (si ya existía, lo reemplaza)
DROP TRIGGER IF EXISTS trg_set_reporte_id ON public.reportes;
CREATE TRIGGER trg_set_reporte_id
  BEFORE INSERT ON public.reportes
  FOR EACH ROW EXECUTE FUNCTION public.set_reporte_id();

NOTIFY pgrst, 'reload schema';
SELECT 'Trigger de reporte_id creado — ya no habrá códigos duplicados' AS estado;
