-- =========================================================================
-- 063_diagnostico_datos_vacios.sql
-- DIAGNÓSTICO (solo lectura): cuántos registros tienen cada campo vacío.
-- No modifica ningún dato. Se puede correr en pruebas y en producción.
--
-- Cuenta como "vacío": NULL, texto en blanco ('' o solo espacios) y arrays vacíos.
-- Resultado: una fila por tabla/columna con vacíos, ordenado de peor a mejor.
--
-- CÓMO CORRERLO: el SQL Editor de Supabase muestra solo el último resultado.
-- Seleccioná el CREATE FUNCTION + UNA de las consultas (1, 2 o 3) y tocá "Run selected".
-- Los precios en 0 no cuentan como vacíos (solo NULL); para eso mirá la consulta 2.
-- =========================================================================

CREATE OR REPLACE FUNCTION pg_temp.diagnostico_vacios()
RETURNS TABLE (tabla TEXT, columna TEXT, total BIGINT, vacios BIGINT, porcentaje NUMERIC)
LANGUAGE plpgsql
AS $$
DECLARE
  c RECORD;
  v_condicion TEXT;
BEGIN
  FOR c IN
    SELECT col.table_name, col.column_name, col.data_type
    FROM information_schema.columns col
    JOIN information_schema.tables t
      ON t.table_schema = col.table_schema AND t.table_name = col.table_name
    WHERE col.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
    ORDER BY col.table_name, col.ordinal_position
  LOOP
    v_condicion := format('%I IS NULL', c.column_name);
    IF c.data_type IN ('text', 'character varying', 'character') THEN
      v_condicion := v_condicion || format(' OR btrim(%I) = %L', c.column_name, '');
    ELSIF c.data_type = 'ARRAY' THEN
      v_condicion := v_condicion || format(' OR cardinality(%I) = 0', c.column_name);
    END IF;

    RETURN QUERY EXECUTE format(
      'SELECT %L::TEXT, %L::TEXT, count(*), count(*) FILTER (WHERE %s),
              round(100.0 * count(*) FILTER (WHERE %s) / NULLIF(count(*), 0), 1)
       FROM public.%I',
      c.table_name, c.column_name, v_condicion, v_condicion, c.table_name
    );
  END LOOP;
END;
$$;

-- 1. Detalle por columna (solo las que tienen algún vacío)
SELECT tabla, columna, total, vacios, porcentaje || '%' AS porcentaje_vacio
FROM pg_temp.diagnostico_vacios()
WHERE vacios > 0
ORDER BY porcentaje DESC, tabla, columna;

-- 2. Foco en los datos maestros que la app ahora exige completos.
--    (Copiar este resultado para el informe al cliente)
SELECT tabla, columna, total, vacios, porcentaje || '%' AS porcentaje_vacio
FROM pg_temp.diagnostico_vacios()
WHERE (tabla, columna) IN (
  ('obras', 'cliente_id'), ('obras', 'sitio'), ('obras', 'alcance_tecnico'),
  ('obras', 'fecha_inicio_est'), ('obras', 'fecha_fin_est'), ('obras', 'jefe_obra_id'),
  ('obras', 'presupuesto'),
  ('clientes', 'cuit'), ('clientes', 'contacto'), ('clientes', 'email'),
  ('clientes', 'telefono'), ('clientes', 'direccion'),
  ('proveedores', 'cuit'), ('proveedores', 'contacto'), ('proveedores', 'email'),
  ('proveedores', 'telefono'), ('proveedores', 'direccion'), ('proveedores', 'rubros'),
  ('inventario', 'proveedor_principal_id'), ('inventario', 'ubicacion_fisica'),
  ('inventario', 'precio_costo'),
  ('usuarios', 'telefono')
)
ORDER BY tabla, columna;

-- 3. Obras sin ningún técnico asignado
SELECT o.obra_id, o.nombre_obra, o.estado
FROM public.obras o
WHERE NOT EXISTS (SELECT 1 FROM public.obra_tecnicos ot WHERE ot.obra_id = o.id)
ORDER BY o.created_at DESC;
