-- =========================================================================
-- 064_obra_historial.sql
-- Historial de cambios de estado de las obras (para el detalle de obra)
-- =========================================================================

-- 1. Tabla de historial
CREATE TABLE IF NOT EXISTS public.obra_historial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('creada', 'estado')),
  estado_anterior TEXT,
  estado_nuevo TEXT,
  comentario TEXT,
  usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL, -- NULL = sistema
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_obra_historial_obra
  ON public.obra_historial(obra_id, created_at DESC);

-- 2. RLS: lo ve quien puede ver la obra (la subconsulta respeta el RLS de obras).
--    Nadie inserta directo: lo hace el trigger.
ALTER TABLE public.obra_historial ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ver_historial_de_obras_visibles" ON public.obra_historial;
CREATE POLICY "ver_historial_de_obras_visibles"
ON public.obra_historial FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.obras o WHERE o.id = obra_historial.obra_id));

-- 3. Trigger: registra la creación y cada cambio de estado, venga de donde venga
--    (botones de la lista, detalle, cierre con devoluciones, reabrir, etc.)
CREATE OR REPLACE FUNCTION public.registrar_historial_obra()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.obra_historial (obra_id, tipo, estado_nuevo, usuario_id)
    VALUES (NEW.id, 'creada', NEW.estado, COALESCE(auth.uid(), NEW.created_by));
  ELSIF NEW.estado IS DISTINCT FROM OLD.estado THEN
    INSERT INTO public.obra_historial (obra_id, tipo, estado_anterior, estado_nuevo, usuario_id)
    VALUES (NEW.id, 'estado', OLD.estado, NEW.estado, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_obras_historial ON public.obras;
CREATE TRIGGER trg_obras_historial
AFTER INSERT OR UPDATE OF estado ON public.obras
FOR EACH ROW
EXECUTE FUNCTION public.registrar_historial_obra();

-- 4. Agregar un comentario al último cambio de estado (lo usa "Cambiar estado" del detalle).
--    Solo el mismo usuario, sobre un cambio de los últimos 10 minutos y sin comentario.
CREATE OR REPLACE FUNCTION public.comentar_cambio_estado_obra(p_obra_id UUID, p_comentario TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NULLIF(TRIM(p_comentario), '') IS NULL THEN RETURN; END IF;

  UPDATE public.obra_historial
  SET comentario = TRIM(p_comentario)
  WHERE id = (
    SELECT id FROM public.obra_historial
    WHERE obra_id = p_obra_id
      AND usuario_id = auth.uid()
      AND comentario IS NULL
      AND created_at > NOW() - INTERVAL '10 minutes'
    ORDER BY created_at DESC
    LIMIT 1
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.comentar_cambio_estado_obra(UUID, TEXT) TO authenticated;

-- 5. Cargar la creación de las obras que ya existen (para que el historial no arranque vacío)
INSERT INTO public.obra_historial (obra_id, tipo, estado_nuevo, usuario_id, created_at, comentario)
SELECT o.id, 'creada', o.estado,
       CASE WHEN EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = o.created_by) THEN o.created_by END,
       COALESCE(o.created_at, NOW()),
       'Registro previo al historial (estado actual: ' || o.estado || ')'
FROM public.obras o
WHERE NOT EXISTS (SELECT 1 FROM public.obra_historial h WHERE h.obra_id = o.id);

NOTIFY pgrst, 'reload schema';
SELECT 'Migracion 064 completada — historial de obras' AS estado;
