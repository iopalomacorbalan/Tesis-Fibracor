-- =========================================================================
-- 034_asignacion_diaria.sql
-- Tipos de movimiento para asignación personal a técnicos
-- (sin vinculación a obra)
-- =========================================================================

-- 1. Detectar y actualizar el constraint de tipo si existe
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.movimientos'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%tipo%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.movimientos DROP CONSTRAINT %I', v_constraint_name);
    RAISE NOTICE 'Removido constraint: %', v_constraint_name;
  END IF;
END $$;

-- 2. Re-crear constraint incluyendo los nuevos tipos
ALTER TABLE public.movimientos
  ADD CONSTRAINT movimientos_tipo_check
  CHECK (tipo IN (
    'Ingreso_compra', 'Ingreso_inicial', 'Ajuste_positivo', 'Ajuste_negativo',
    'Retiro', 'Devolucion_pendiente', 'Devolucion', 'Reactivacion', 'Baja',
    'Transferencia',
    -- NUEVOS: asignación personal sin obra
    'Asignacion_personal', 'Devolucion_personal_pendiente', 'Devolucion_personal'
  ));

-- 3. Permitir obra_id NULL en movimientos (asignaciones personales no van a obra)
-- (probablemente ya está permitido, lo verifico)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'movimientos'
      AND column_name = 'obra_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.movimientos ALTER COLUMN obra_id DROP NOT NULL;
    RAISE NOTICE 'Hizo obra_id nullable';
  END IF;
END $$;

-- 4. RPC: herramientas personales asignadas a un técnico (sin obra)
CREATE OR REPLACE FUNCTION public.get_herramientas_personales(p_tecnico_id UUID)
RETURNS TABLE (
  item_id UUID,
  item_codigo TEXT,
  descripcion TEXT,
  categoria TEXT,
  unidad TEXT,
  numero_serie TEXT,
  ubicacion_fisica TEXT,
  cantidad_asignada NUMERIC,
  cantidad_devuelta NUMERIC,
  cantidad_pendiente NUMERIC,
  cantidad_en_poder NUMERIC,
  ultima_asignacion TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id AS item_id,
    i.item_id AS item_codigo,
    i.descripcion,
    i.categoria::TEXT,
    i.unidad,
    i.numero_serie,
    i.ubicacion_fisica,
    COALESCE(SUM(CASE WHEN m.tipo = 'Asignacion_personal' THEN m.cantidad ELSE 0 END), 0)::NUMERIC AS cantidad_asignada,
    COALESCE(SUM(CASE WHEN m.tipo = 'Devolucion_personal' THEN m.cantidad ELSE 0 END), 0)::NUMERIC AS cantidad_devuelta,
    COALESCE(SUM(CASE WHEN m.tipo = 'Devolucion_personal_pendiente' THEN m.cantidad ELSE 0 END), 0)::NUMERIC AS cantidad_pendiente,
    (
      COALESCE(SUM(CASE WHEN m.tipo = 'Asignacion_personal' THEN m.cantidad ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN m.tipo = 'Devolucion_personal' THEN m.cantidad ELSE 0 END), 0)
    )::NUMERIC AS cantidad_en_poder,
    MAX(CASE WHEN m.tipo = 'Asignacion_personal' THEN m.fecha END) AS ultima_asignacion
  FROM public.inventario i
  JOIN public.movimientos m ON m.item_id = i.id
  WHERE m.tecnico_id = p_tecnico_id
    AND m.tipo IN ('Asignacion_personal', 'Devolucion_personal', 'Devolucion_personal_pendiente')
  GROUP BY i.id, i.item_id, i.descripcion, i.categoria, i.unidad, i.numero_serie, i.ubicacion_fisica
  HAVING (
    COALESCE(SUM(CASE WHEN m.tipo = 'Asignacion_personal' THEN m.cantidad ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN m.tipo = 'Devolucion_personal' THEN m.cantidad ELSE 0 END), 0)
  ) > 0
  ORDER BY i.descripcion;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_herramientas_personales(UUID) TO authenticated;

-- 5. Trigger para descontar/devolver stock en movimientos personales.
-- Compatible con sistema existente.
CREATE OR REPLACE FUNCTION public.fn_movimiento_personal_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Solo procesamos los tipos personales
  IF NEW.tipo = 'Asignacion_personal' THEN
    -- Descontar stock disponible y sumar a "en obra"
    -- (lo tratamos parecido a un Retiro pero sin obra)
    UPDATE public.inventario
    SET stock_disponible = stock_disponible - NEW.cantidad,
        stock_en_obra = stock_en_obra + NEW.cantidad,
        updated_at = NOW()
    WHERE id = NEW.item_id;

  ELSIF NEW.tipo = 'Devolucion_personal' THEN
    -- Devolver del "en obra" al disponible
    UPDATE public.inventario
    SET stock_disponible = stock_disponible + NEW.cantidad,
        stock_en_obra = stock_en_obra - NEW.cantidad,
        updated_at = NOW()
    WHERE id = NEW.item_id;
  END IF;
  -- Devolucion_personal_pendiente: no toca stock (es solo solicitud)

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_movimiento_personal_stock ON public.movimientos;
CREATE TRIGGER trg_movimiento_personal_stock
AFTER INSERT ON public.movimientos
FOR EACH ROW
WHEN (NEW.tipo IN ('Asignacion_personal', 'Devolucion_personal'))
EXECUTE FUNCTION public.fn_movimiento_personal_stock();

NOTIFY pgrst, 'reload schema';
SELECT 'Migracion 034 completada' AS estado;
