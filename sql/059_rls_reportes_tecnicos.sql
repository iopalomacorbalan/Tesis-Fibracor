-- =========================================================================
-- 059_rls_reportes_tecnicos.sql
-- Los técnicos solo ven los reportes de las obras donde están asignados.
-- Dirección, Operaciones, Contabilidad, Comercial y Pañol ven todos.
--
-- Nota: la asignación se evalúa en el momento (no importa si el reporte se
-- creó antes de asignarlos): si hoy está asignado a la obra, ve todos los
-- reportes de esa obra, incluso los anteriores a su asignación.
-- =========================================================================

ALTER TABLE public.reportes ENABLE ROW LEVEL SECURITY;

-- ===== SELECT =====
DROP POLICY IF EXISTS "reportes_select" ON public.reportes;
CREATE POLICY "reportes_select" ON public.reportes
FOR SELECT TO authenticated
USING (
  -- Áreas administrativas: ven todos los reportes
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND u.activo = true
      AND u.area IN ('Direccion', 'Operaciones', 'Contabilidad', 'Comercial', 'Paniol')
  )
  OR
  -- Técnico asignado a la obra del reporte
  EXISTS (
    SELECT 1 FROM public.obra_tecnicos ot
    WHERE ot.obra_id = reportes.obra_id
      AND ot.tecnico_id = auth.uid()
  )
  OR
  -- El técnico que creó el reporte siempre puede verlo
  reportes.tecnico_id = auth.uid()
  OR
  -- Técnico que figura como presente en el reporte
  EXISTS (
    SELECT 1 FROM public.reporte_tecnicos rt
    WHERE rt.reporte_id = reportes.id
      AND rt.tecnico_id = auth.uid()
  )
);

-- ===== INSERT =====
-- Un técnico puede cargar reportes en obras donde está asignado.
DROP POLICY IF EXISTS "reportes_insert" ON public.reportes;
CREATE POLICY "reportes_insert" ON public.reportes
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND u.activo = true
      AND u.area IN ('Direccion', 'Operaciones', 'Contabilidad', 'Comercial', 'Paniol')
  )
  OR
  EXISTS (
    SELECT 1 FROM public.obra_tecnicos ot
    WHERE ot.obra_id = reportes.obra_id
      AND ot.tecnico_id = auth.uid()
  )
);

-- ===== UPDATE =====
DROP POLICY IF EXISTS "reportes_update" ON public.reportes;
CREATE POLICY "reportes_update" ON public.reportes
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND u.activo = true
      AND u.area IN ('Direccion', 'Operaciones', 'Contabilidad', 'Comercial', 'Paniol')
  )
  OR reportes.tecnico_id = auth.uid()
);

-- ===== DELETE =====
DROP POLICY IF EXISTS "reportes_delete" ON public.reportes;
CREATE POLICY "reportes_delete" ON public.reportes
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND u.activo = true
      AND u.area IN ('Direccion', 'Operaciones', 'Contabilidad')
  )
);

-- ===== FOTOS DE REPORTES =====
-- Las fotos siguen la misma regla que su reporte: el EXISTS sobre public.reportes
-- ya queda filtrado por la política de arriba (RLS se aplica en cascada), así que
-- si el usuario no puede ver el reporte, tampoco ve sus fotos.
ALTER TABLE public.reporte_fotos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reporte_fotos_select" ON public.reporte_fotos;
CREATE POLICY "reporte_fotos_select" ON public.reporte_fotos
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.reportes r
    WHERE r.id = reporte_fotos.reporte_id
  )
);

DROP POLICY IF EXISTS "reporte_fotos_insert" ON public.reporte_fotos;
CREATE POLICY "reporte_fotos_insert" ON public.reporte_fotos
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.reportes r
    WHERE r.id = reporte_fotos.reporte_id
  )
);

DROP POLICY IF EXISTS "reporte_fotos_delete" ON public.reporte_fotos;
CREATE POLICY "reporte_fotos_delete" ON public.reporte_fotos
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.reportes r
    WHERE r.id = reporte_fotos.reporte_id
  )
);

NOTIFY pgrst, 'reload schema';

-- ===== VERIFICACIÓN =====
-- Muestra qué reportes vería cada técnico según sus obras asignadas.
SELECT
  u.nombre AS tecnico,
  COUNT(DISTINCT ot.obra_id) AS obras_asignadas,
  COUNT(DISTINCT r.id) AS reportes_visibles
FROM public.usuarios u
LEFT JOIN public.obra_tecnicos ot ON ot.tecnico_id = u.id
LEFT JOIN public.reportes r ON r.obra_id = ot.obra_id
WHERE u.area = 'Tecnico' AND u.activo = true
GROUP BY u.nombre
ORDER BY u.nombre;

SELECT 'Migracion 059 completada — Técnicos solo ven reportes de sus obras' AS estado;
