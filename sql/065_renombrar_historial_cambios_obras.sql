-- =========================================================================
-- 065_renombrar_historial_cambios_obras.sql
-- Renombra obra_historial -> historial_cambios_obras (tabla, índice, política y trigger)
-- Depende de: 064
-- =========================================================================

ALTER TABLE IF EXISTS public.obra_historial RENAME TO historial_cambios_obras;

ALTER INDEX IF EXISTS public.idx_obra_historial_obra RENAME TO idx_historial_cambios_obras_obra;

DROP POLICY IF EXISTS "ver_historial_de_obras_visibles" ON public.historial_cambios_obras;
CREATE POLICY "ver_historial_cambios_obras_visibles"
ON public.historial_cambios_obras FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.obras o WHERE o.id = historial_cambios_obras.obra_id));

-- Las funciones apuntan a la tabla por nombre: se recrean con el nombre nuevo
CREATE OR REPLACE FUNCTION public.registrar_historial_obra()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.historial_cambios_obras (obra_id, tipo, estado_nuevo, usuario_id)
    VALUES (NEW.id, 'creada', NEW.estado, COALESCE(auth.uid(), NEW.created_by));
  ELSIF NEW.estado IS DISTINCT FROM OLD.estado THEN
    INSERT INTO public.historial_cambios_obras (obra_id, tipo, estado_anterior, estado_nuevo, usuario_id)
    VALUES (NEW.id, 'estado', OLD.estado, NEW.estado, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.comentar_cambio_estado_obra(p_obra_id UUID, p_comentario TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NULLIF(TRIM(p_comentario), '') IS NULL THEN RETURN; END IF;

  UPDATE public.historial_cambios_obras
  SET comentario = TRIM(p_comentario)
  WHERE id = (
    SELECT id FROM public.historial_cambios_obras
    WHERE obra_id = p_obra_id
      AND usuario_id = auth.uid()
      AND comentario IS NULL
      AND created_at > NOW() - INTERVAL '10 minutes'
    ORDER BY created_at DESC
    LIMIT 1
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
SELECT 'Migracion 065 completada — tabla historial_cambios_obras' AS estado;
