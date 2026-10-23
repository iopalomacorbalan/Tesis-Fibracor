-- =========================================================================
-- 069_tablero_control.sql
-- Función get_tablero_control(): devuelve en un solo JSON los indicadores del
-- tablero de control del Dashboard (plata, gasto mensual, materiales, clientes,
-- personal y plazos). Solo Dirección, Contabilidad y Operaciones.
--
-- Costo de una obra = materiales consumibles (retiros - devoluciones) a precio de costo
--                   + herramientas no devueltas + costos extras + horas técnicas
-- (misma fórmula que la pestaña Costos del detalle de obra, con horas incluidas).
-- Las OC NO suman al costo de obra (sus materiales ya se cuentan al retirarlos del stock).
-- Depende de: get_herramientas_obra y get_herramientas_personales (ya existentes).
-- =========================================================================

CREATE OR REPLACE FUNCTION public.get_tablero_control()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_precio_hora NUMERIC;
  v_herr_por_obra JSONB := '{}'::jsonb;   -- {obra_uuid: costo de herramientas no devueltas}
  v_obras JSONB;
  v_gasto JSONB;
  v_materiales JSONB;
  v_clientes JSONB;
  v_personal JSONB := '[]'::jsonb;
  v_plazos JSONB;
  r RECORD;
  v_herr NUMERIC;
  v_en_poder NUMERIC;
  v_inicio_mes DATE := date_trunc('month', CURRENT_DATE)::DATE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid() AND activo = true
      AND area IN ('Direccion', 'Contabilidad', 'Operaciones')
  ) THEN
    RAISE EXCEPTION 'No tenés permiso para ver el tablero de control';
  END IF;

  SELECT COALESCE((valor->>'amount')::NUMERIC, 0) INTO v_precio_hora
  FROM public.configuracion_global WHERE clave = 'precio_hora_tecnica';
  v_precio_hora := COALESCE(v_precio_hora, 0);

  -- ===== 1. Plata de las obras en curso =====
  FOR r IN SELECT id FROM public.obras WHERE estado IN ('En ejecucion', 'Para cierre') LOOP
    v_herr := 0;
    BEGIN
      SELECT COALESCE(SUM(h.cantidad_no_devuelta * h.precio_costo), 0) INTO v_herr
      FROM public.get_herramientas_obra(r.id) h
      WHERE h.estado_final = 'No devuelta';
    EXCEPTION WHEN OTHERS THEN
      v_herr := 0;
    END;
    v_herr_por_obra := v_herr_por_obra || jsonb_build_object(r.id::TEXT, v_herr);
  END LOOP;

  WITH consumo AS (
    SELECT m.obra_id, m.item_id,
           SUM(CASE WHEN m.tipo = 'Retiro' THEN m.cantidad
                    WHEN m.tipo = 'Devolucion' THEN -m.cantidad ELSE 0 END) AS cant
    FROM public.movimientos m
    WHERE m.obra_id IS NOT NULL AND m.tipo IN ('Retiro', 'Devolucion')
    GROUP BY m.obra_id, m.item_id
  ),
  materiales AS (
    SELECT c.obra_id, SUM(GREATEST(c.cant, 0) * COALESCE(i.precio_costo, 0)) AS total
    FROM consumo c
    JOIN public.inventario i ON i.id = c.item_id AND i.categoria IN ('Material', 'Consumo')
    GROUP BY c.obra_id
  ),
  extras AS (
    SELECT obra_id, SUM(monto) AS total FROM public.costos_extras_obra GROUP BY obra_id
  ),
  horas AS (
    SELECT rep.obra_id,
           SUM(EXTRACT(EPOCH FROM (rep.hora_salida - rep.hora_entrada)) / 3600.0) * v_precio_hora AS total
    FROM public.reporte_tecnicos rt
    JOIN public.reportes rep ON rep.id = rt.reporte_id
    WHERE rep.hora_entrada IS NOT NULL AND rep.hora_salida IS NOT NULL
    GROUP BY rep.obra_id
  ),
  detalle AS (
    SELECT o.id, o.obra_id AS codigo, o.nombre_obra, cl.nombre AS cliente, o.estado,
           COALESCE(o.presupuesto, 0) AS presupuesto,
           COALESCE(m.total, 0)
             + COALESCE((v_herr_por_obra ->> o.id::TEXT)::NUMERIC, 0)
             + COALESCE(e.total, 0)
             + COALESCE(h.total, 0) AS costo
    FROM public.obras o
    LEFT JOIN public.clientes cl ON cl.id = o.cliente_id
    LEFT JOIN materiales m ON m.obra_id = o.id
    LEFT JOIN extras e ON e.obra_id = o.id
    LEFT JOIN horas h ON h.obra_id = o.id
    WHERE o.estado IN ('En ejecucion', 'Para cierre')
  )
  SELECT jsonb_build_object(
    'cantidad', COUNT(*),
    'presupuesto', COALESCE(SUM(presupuesto), 0),
    'costo', COALESCE(SUM(costo), 0),
    'margen', COALESCE(SUM(presupuesto - costo), 0),
    'obras', COALESCE(jsonb_agg(jsonb_build_object(
      'id', id, 'codigo', codigo, 'nombre', nombre_obra, 'cliente', cliente, 'estado', estado,
      'presupuesto', presupuesto, 'costo', costo,
      'margen', presupuesto - costo,
      'margen_pct', CASE WHEN presupuesto > 0
                         THEN ROUND(((presupuesto - costo) / presupuesto * 100)::NUMERIC, 1)
                         ELSE NULL END
    ) ORDER BY (CASE WHEN presupuesto > 0 THEN (presupuesto - costo) / presupuesto ELSE 1 END)), '[]'::jsonb)
  ) INTO v_obras
  FROM detalle;

  -- ===== 2. Gasto de los últimos 6 meses (solo OC en pesos + caja chica) =====
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'mes', to_char(mes, 'YYYY-MM'),
    'compras', COALESCE((
      SELECT SUM(c.total_estimado) FROM public.compras c
      WHERE date_trunc('month', c.fecha_solicitud) = mes
        AND c.estado NOT IN ('Cancelada', 'Rechazada')
        AND COALESCE(c.moneda, 'ARS') = 'ARS'
    ), 0),
    'caja_chica', COALESCE((
      SELECT SUM(cc.monto) FROM public.caja_chica cc
      WHERE date_trunc('month', cc.fecha) = mes
    ), 0)
  ) ORDER BY mes), '[]'::jsonb) INTO v_gasto
  FROM generate_series(
    date_trunc('month', CURRENT_DATE) - INTERVAL '5 months',
    date_trunc('month', CURRENT_DATE),
    INTERVAL '1 month'
  ) AS mes;

  -- ===== 3. Top 5 materiales por costo consumido en obras =====
  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.total DESC), '[]'::jsonb) INTO v_materiales
  FROM (
    SELECT i.item_id AS codigo, i.descripcion, i.unidad,
           SUM(GREATEST(c.cant, 0)) AS cantidad,
           SUM(GREATEST(c.cant, 0) * COALESCE(i.precio_costo, 0)) AS total
    FROM (
      SELECT m.obra_id, m.item_id,
             SUM(CASE WHEN m.tipo = 'Retiro' THEN m.cantidad
                      WHEN m.tipo = 'Devolucion' THEN -m.cantidad ELSE 0 END) AS cant
      FROM public.movimientos m
      WHERE m.obra_id IS NOT NULL AND m.tipo IN ('Retiro', 'Devolucion')
      GROUP BY m.obra_id, m.item_id
    ) c
    JOIN public.inventario i ON i.id = c.item_id AND i.categoria IN ('Material', 'Consumo')
    GROUP BY i.item_id, i.descripcion, i.unidad
    HAVING SUM(GREATEST(c.cant, 0)) > 0
    ORDER BY total DESC
    LIMIT 5
  ) t;

  -- ===== 4. Clientes =====
  SELECT jsonb_build_object(
    'total', (SELECT COUNT(*) FROM public.clientes WHERE activo = true AND deleted_at IS NULL),
    'con_obra_en_curso', (SELECT COUNT(DISTINCT cliente_id) FROM public.obras
                          WHERE estado IN ('En ejecucion', 'Para cierre') AND cliente_id IS NOT NULL),
    'recurrentes', (SELECT COUNT(*) FROM (
                      SELECT cliente_id FROM public.obras
                      WHERE cliente_id IS NOT NULL AND estado <> 'Cancelada'
                      GROUP BY cliente_id HAVING COUNT(*) >= 2) x),
    'top', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('nombre', nombre, 'obras', obras, 'presupuesto', presupuesto)
                       ORDER BY presupuesto DESC)
      FROM (
        SELECT cl.nombre, COUNT(*) AS obras, COALESCE(SUM(o.presupuesto), 0) AS presupuesto
        FROM public.obras o JOIN public.clientes cl ON cl.id = o.cliente_id
        WHERE o.estado <> 'Cancelada'
        GROUP BY cl.nombre ORDER BY presupuesto DESC LIMIT 5
      ) t
    ), '[]'::jsonb)
  ) INTO v_clientes;

  -- ===== 5. Personal (técnicos activos, mes actual) =====
  FOR r IN
    SELECT u.id, u.nombre,
           COALESCE(SUM(EXTRACT(EPOCH FROM (rep.hora_salida - rep.hora_entrada)) / 3600.0)
             FILTER (WHERE rep.hora_entrada IS NOT NULL AND rep.hora_salida IS NOT NULL), 0) AS horas,
           COUNT(DISTINCT rep.id) AS reportes
    FROM public.usuarios u
    LEFT JOIN public.reporte_tecnicos rt ON rt.tecnico_id = u.id
    LEFT JOIN public.reportes rep ON rep.id = rt.reporte_id AND rep.fecha >= v_inicio_mes
    WHERE u.area = 'Tecnico' AND u.activo = true
    GROUP BY u.id, u.nombre
    ORDER BY horas DESC, u.nombre
  LOOP
    v_en_poder := 0;
    BEGIN
      SELECT COALESCE(SUM(h.cantidad_en_poder), 0) INTO v_en_poder
      FROM public.get_herramientas_personales(r.id) h;
    EXCEPTION WHEN OTHERS THEN
      v_en_poder := 0;
    END;
    v_personal := v_personal || jsonb_build_object(
      'nombre', r.nombre,
      'horas_mes', ROUND(r.horas::NUMERIC, 1),
      'reportes_mes', r.reportes,
      'herramientas_en_poder', v_en_poder
    );
  END LOOP;

  -- ===== 6. Plazos =====
  SELECT jsonb_build_object(
    'atrasadas', (SELECT COUNT(*) FROM public.obras
                  WHERE estado IN ('Pendiente OIO', 'En ejecucion', 'Para cierre')
                    AND fecha_fin_est IS NOT NULL AND fecha_fin_est < CURRENT_DATE),
    'lista_atrasadas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'codigo', obra_id, 'nombre', nombre_obra, 'fecha_fin_est', fecha_fin_est,
        'dias', CURRENT_DATE - fecha_fin_est) ORDER BY fecha_fin_est)
      FROM (SELECT * FROM public.obras
            WHERE estado IN ('Pendiente OIO', 'En ejecucion', 'Para cierre')
              AND fecha_fin_est IS NOT NULL AND fecha_fin_est < CURRENT_DATE
            ORDER BY fecha_fin_est LIMIT 5) a
    ), '[]'::jsonb),
    'cerradas', (SELECT COUNT(*) FROM public.obras WHERE estado = 'Cerrada' AND fecha_fin_est IS NOT NULL),
    'cerradas_a_tiempo', (SELECT COUNT(*) FROM public.obras
                          WHERE estado = 'Cerrada' AND fecha_fin_est IS NOT NULL
                            AND COALESCE(fecha_fin_real, closed_at::DATE) <= fecha_fin_est)
  ) INTO v_plazos;

  RETURN jsonb_build_object(
    'obras', v_obras,
    'gasto_mensual', v_gasto,
    'materiales', v_materiales,
    'clientes', v_clientes,
    'personal', v_personal,
    'plazos', v_plazos
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_tablero_control() TO authenticated;

NOTIFY pgrst, 'reload schema';
SELECT 'Migracion 069 completada — tablero de control' AS estado;
