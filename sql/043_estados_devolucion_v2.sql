-- =========================================================================
-- 043_estados_devolucion_v2.sql
-- Agregar destino al recibir devolución: disponible / revisión / baja
-- VERSIÓN CORREGIDA: incluye DROP FUNCTION antes de redefinir
-- =========================================================================

-- 1. Agregar columna `estado_destino` a movimientos
ALTER TABLE public.movimientos
  ADD COLUMN IF NOT EXISTS estado_destino TEXT
  CHECK (estado_destino IN ('disponible', 'revision', 'baja'));

COMMENT ON COLUMN public.movimientos.estado_destino IS
  'Para Devolucion / Devolucion_personal: indica si vuelve a disponible, a revisión, o se da de baja';

-- 2. DROP de funciones existentes (para evitar conflicto de retorno)
DROP FUNCTION IF EXISTS public.aceptar_devolucion(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.reactivar_desde_revision(UUID, TEXT);
DROP FUNCTION IF EXISTS public.dar_baja_desde_revision(UUID, TEXT);
DROP FUNCTION IF EXISTS public.get_items_en_revision();

-- 3. Actualizar la función de recalcular stock
CREATE OR REPLACE FUNCTION public.trigger_recalcular_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_item_id := OLD.item_id;
  ELSE
    v_item_id := NEW.item_id;
  END IF;

  UPDATE public.inventario
  SET
    stock_disponible = COALESCE((
      SELECT SUM(CASE
        WHEN m.tipo IN (
          'Ingreso_compra'::tipo_movimiento, 'Ingreso_inicial'::tipo_movimiento,
          'Ajuste_positivo'::tipo_movimiento, 'Reactivacion'::tipo_movimiento
        ) THEN m.cantidad
        WHEN m.tipo IN ('Devolucion'::tipo_movimiento, 'Devolucion_personal'::tipo_movimiento)
          AND (m.estado_destino IS NULL OR m.estado_destino = 'disponible')
          THEN m.cantidad
        WHEN m.tipo IN ('Ajuste_negativo'::tipo_movimiento, 'Baja'::tipo_movimiento) THEN -m.cantidad
        WHEN m.tipo IN ('Retiro'::tipo_movimiento, 'Asignacion_personal'::tipo_movimiento) THEN -m.cantidad
        ELSE 0
      END)
      FROM public.movimientos m WHERE m.item_id = v_item_id
    ), 0),

    stock_en_obra = COALESCE((
      SELECT SUM(CASE
        WHEN m.tipo IN ('Retiro'::tipo_movimiento, 'Asignacion_personal'::tipo_movimiento) THEN m.cantidad
        WHEN m.tipo IN ('Devolucion'::tipo_movimiento, 'Devolucion_personal'::tipo_movimiento) THEN -m.cantidad
        ELSE 0
      END)
      FROM public.movimientos m WHERE m.item_id = v_item_id
    ), 0),

    stock_fuera_servicio = COALESCE((
      SELECT SUM(CASE
        WHEN m.tipo IN ('Devolucion'::tipo_movimiento, 'Devolucion_personal'::tipo_movimiento)
          AND m.estado_destino IN ('revision', 'baja')
          THEN m.cantidad
        WHEN m.tipo = 'Reactivacion'::tipo_movimiento THEN -m.cantidad
        WHEN m.tipo = 'Baja'::tipo_movimiento THEN -m.cantidad
        ELSE 0
      END)
      FROM public.movimientos m WHERE m.item_id = v_item_id
    ), 0),

    updated_at = NOW()
  WHERE id = v_item_id;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- 4. RPC: listar items en revisión
CREATE FUNCTION public.get_items_en_revision()
RETURNS TABLE (
  movimiento_id UUID,
  item_id UUID,
  item_codigo TEXT,
  descripcion TEXT,
  categoria TEXT,
  unidad TEXT,
  numero_serie TEXT,
  ubicacion_fisica TEXT,
  cantidad NUMERIC,
  fecha_devolucion TIMESTAMPTZ,
  estado_destino TEXT,
  tipo_movimiento TEXT,
  tecnico_id UUID,
  tecnico_nombre TEXT,
  obra_id UUID,
  obra_codigo TEXT,
  observaciones TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id AS movimiento_id,
    i.id AS item_id,
    i.item_id AS item_codigo,
    i.descripcion,
    i.categoria::TEXT,
    i.unidad,
    i.numero_serie,
    i.ubicacion_fisica,
    m.cantidad,
    m.fecha AS fecha_devolucion,
    m.estado_destino,
    m.tipo::TEXT AS tipo_movimiento,
    m.tecnico_id,
    u.nombre AS tecnico_nombre,
    m.obra_id,
    o.obra_id AS obra_codigo,
    m.observaciones
  FROM public.movimientos m
  JOIN public.inventario i ON i.id = m.item_id
  LEFT JOIN public.usuarios u ON u.id = m.tecnico_id
  LEFT JOIN public.obras o ON o.id = m.obra_id
  WHERE m.tipo IN ('Devolucion'::tipo_movimiento, 'Devolucion_personal'::tipo_movimiento)
    AND m.estado_destino = 'revision'
    AND NOT EXISTS (
      SELECT 1 FROM public.movimientos m2
      WHERE m2.item_id = m.item_id
        AND m2.tipo IN ('Reactivacion'::tipo_movimiento, 'Baja'::tipo_movimiento)
        AND m2.fecha > m.fecha
        AND COALESCE(m2.observaciones, '') LIKE '%[mov:' || m.id::TEXT || ']%'
    )
  ORDER BY m.fecha DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_items_en_revision() TO authenticated;

-- 5. RPC: reactivar item desde revisión
CREATE FUNCTION public.reactivar_desde_revision(
  p_movimiento_id UUID,
  p_observaciones TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mov RECORD;
  v_new_id UUID;
BEGIN
  SELECT * INTO v_mov FROM public.movimientos WHERE id = p_movimiento_id;
  IF v_mov IS NULL THEN
    RAISE EXCEPTION 'Movimiento no encontrado';
  END IF;
  IF v_mov.estado_destino != 'revision' THEN
    RAISE EXCEPTION 'Este movimiento no está en revisión';
  END IF;

  INSERT INTO public.movimientos (tipo, item_id, cantidad, tecnico_id, obra_id, fecha, observaciones)
  VALUES (
    'Reactivacion'::tipo_movimiento,
    v_mov.item_id,
    v_mov.cantidad,
    v_mov.tecnico_id,
    v_mov.obra_id,
    NOW(),
    COALESCE(p_observaciones, 'Reparado / vuelve a disponible') || ' [mov:' || p_movimiento_id::TEXT || ']'
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reactivar_desde_revision(UUID, TEXT) TO authenticated;

-- 6. RPC: dar de baja desde revisión
CREATE FUNCTION public.dar_baja_desde_revision(
  p_movimiento_id UUID,
  p_observaciones TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mov RECORD;
  v_new_id UUID;
BEGIN
  SELECT * INTO v_mov FROM public.movimientos WHERE id = p_movimiento_id;
  IF v_mov IS NULL THEN
    RAISE EXCEPTION 'Movimiento no encontrado';
  END IF;
  IF v_mov.estado_destino != 'revision' THEN
    RAISE EXCEPTION 'Este movimiento no está en revisión';
  END IF;

  INSERT INTO public.movimientos (tipo, item_id, cantidad, tecnico_id, obra_id, fecha, observaciones)
  VALUES (
    'Baja'::tipo_movimiento,
    v_mov.item_id,
    v_mov.cantidad,
    v_mov.tecnico_id,
    v_mov.obra_id,
    NOW(),
    COALESCE(p_observaciones, 'Dado de baja desde revisión') || ' [mov:' || p_movimiento_id::TEXT || ']'
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dar_baja_desde_revision(UUID, TEXT) TO authenticated;

-- 7. Recrear aceptar_devolucion (flujo de obra) con estado_destino
CREATE FUNCTION public.aceptar_devolucion(
  p_mov_pendiente_id UUID,
  p_estado_recibido TEXT,
  p_observaciones TEXT DEFAULT ''
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mov RECORD;
  v_new_id UUID;
  v_destino TEXT;
BEGIN
  SELECT * INTO v_mov FROM public.movimientos WHERE id = p_mov_pendiente_id;
  IF v_mov IS NULL THEN
    RAISE EXCEPTION 'Solicitud de devolución no encontrada';
  END IF;
  IF v_mov.tipo != 'Devolucion_pendiente'::tipo_movimiento THEN
    RAISE EXCEPTION 'Este movimiento no es una solicitud pendiente';
  END IF;

  v_destino := CASE
    WHEN p_estado_recibido = 'Bueno' THEN 'disponible'
    WHEN p_estado_recibido IN ('Dañada', 'Dañado', 'Danada') THEN 'baja'
    WHEN p_estado_recibido IN ('Necesita mantenimiento', 'Revisión', 'Revision') THEN 'revision'
    ELSE 'disponible'
  END;

  INSERT INTO public.movimientos (
    tipo, item_id, cantidad, tecnico_id, obra_id, fecha, observaciones, estado_destino
  )
  VALUES (
    'Devolucion'::tipo_movimiento,
    v_mov.item_id,
    v_mov.cantidad,
    v_mov.tecnico_id,
    v_mov.obra_id,
    NOW(),
    COALESCE(NULLIF(TRIM(p_observaciones), ''), 'Devolución recibida (' || p_estado_recibido || ')'),
    v_destino
  )
  RETURNING id INTO v_new_id;

  DELETE FROM public.movimientos WHERE id = p_mov_pendiente_id;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.aceptar_devolucion(UUID, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
SELECT 'Migracion 043 v2 completada' AS estado;
