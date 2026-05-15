-- =========================================================================
-- crear_tecnico.sql
-- Crear un nuevo usuario técnico (Auth + tabla usuarios)
-- =========================================================================

-- IMPORTANTE: Antes de ejecutar, modificá los valores entre <>:
--   <EMAIL>     → email del técnico
--   <PASSWORD>  → contraseña inicial
--   <NOMBRE>    → nombre completo

DO $$
DECLARE
  v_email TEXT := '<EMAIL>';           -- ej: 'juan.perez@fibracor.com'
  v_password TEXT := '<PASSWORD>';     -- ej: 'TecnicoTemporal2025'
  v_nombre TEXT := '<NOMBRE>';         -- ej: 'Juan Pérez'
  v_user_id UUID;
BEGIN
  -- 1. Crear usuario en auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    v_email,
    crypt(v_password, gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  )
  RETURNING id INTO v_user_id;

  -- 2. Crear entrada en public.usuarios
  INSERT INTO public.usuarios (id, email, nombre, area, activo)
  VALUES (v_user_id, v_email, v_nombre, 'Tecnico', true);

  RAISE NOTICE 'Técnico creado: % (UUID: %)', v_email, v_user_id;
END $$;

-- Verificar que quedó creado
SELECT id, email, nombre, area, activo
FROM public.usuarios
WHERE area = 'Tecnico'
ORDER BY nombre;
