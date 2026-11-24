# FIBRACOR App (v6 — Supabase + React)

Aplicación de gestión operativa de redes de datos.

## Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Estilos:** Tailwind CSS + shadcn/ui (Radix primitives)
- **Estado:** Zustand (auth) + React Query (data)
- **Routing:** React Router v6
- **Backend:** Supabase (Postgres + Auth + Storage + Realtime)
- **Validación:** Zod
- **Toasts:** Sonner

## Setup local

### Requisitos
- Node.js 18+ y npm

### Instalación

```bash
# 1. Instalar dependencias
npm install

# 2. Crear .env.local (no se sube a git, hay que armarlo en cada compu)
#    apuntando a fibracor-pruebas, NO al proyecto real:
#    VITE_SUPABASE_URL=https://bippqzutnxjhvktwvxva.supabase.co
#    VITE_SUPABASE_ANON_KEY=<clave anon/publishable de fibracor-pruebas>
#    (Supabase → Project Settings → API Keys). Guardarlo en UTF-8 sin BOM.

# 3. Correr en desarrollo
npm run dev
```

Abrir http://localhost:5173

> ⚠️ `.env.example` tiene la URL de **otro** proyecto: no copiarlo tal cual.

### Problemas comunes en local
- **Página en blanco:** falta `.env.local` o le falta alguna variable. Después de crearlo o cambiarlo, reiniciar `npm run dev`.
- **Se queda en "Cargando perfil...":** el usuario puede iniciar sesión pero no tiene fila en la tabla `usuarios`. Pasa si se creó a mano en Supabase → Authentication. Lo correcto es crearlo desde el módulo **Usuarios** de la app; si ya existe, en el SQL Editor de pruebas:
  ```sql
  INSERT INTO public.usuarios (id, user_id, email, nombre, area, activo)
  SELECT id, id, email, 'Nombre', 'Direccion', true
  FROM auth.users WHERE email = 'el@email.com'
  ON CONFLICT (id) DO NOTHING;
  ```
  `area` es el sector, no la ciudad: `Direccion`, `Operaciones`, `Paniol`, `Comercial`, `Contabilidad` o `Tecnico`.
- **Probar en el celular:** `npm run dev -- --host` y abrir en el celu la dirección `Network:` que muestra (mismo WiFi).

### Build de producción

```bash
npm run build
npm run preview   # ver localmente
```

El output queda en `dist/`. Se puede subir a Vercel/Netlify directo.

## Funcionalidades principales

- **Obras:** alta con formulario por secciones, página de detalle por obra (ficha, progreso, cambio de estado con historial, reportes dentro de la obra y exportación a PDF).
- **Calendario:** calendario de obras y vista **Por técnico**; enlaces de calendario personales y uno central para suscribirse desde Google Calendar.
- **Stock y Herramientas:** inventario, movimientos y revisión, con pestañas; catálogo de unidades.
- **Comercial:** CRM de clientes y proveedores (rubros), remitos con firma por QR, solicitudes y órdenes de compra.
- **Administración:** usuarios (alta desde la app), caja chica, liquidación de horas, auditoría de cambios y copia de seguridad.
- **Dashboard:** indicadores y tablero de control (presupuesto vs. costo, gasto mensual, plazos y personal).
- **Avisos por WhatsApp** a los técnicos asignados a una obra.
- **Backup automático diario** de la base de datos (GitHub Actions).

El detalle de cada cambio, las migraciones SQL y las funciones a publicar está en
[PASAR_A_PRODUCCION.md](PASAR_A_PRODUCCION.md).

## Estructura

```
src/
├── components/
│   ├── ui/              # Componentes de shadcn/ui
│   └── layout/          # Sidebar, Layout, ProtectedRoute
├── lib/
│   ├── supabase.ts      # Cliente
│   ├── auth.ts          # Store de auth (Zustand)
│   └── utils.ts         # Helpers (cn, formatDate, etc)
├── hooks/               # Custom React Query hooks
├── modules/             # Cada feature en su carpeta
│   ├── auth/
│   ├── dashboard/
│   ├── obras/
│   ├── stock/
│   └── ...
├── types/
│   └── database.ts      # Tipos generados de Supabase
├── App.tsx
└── main.tsx
```

## Flujo de auth

1. `App.tsx` llama a `useAuth().init()` al montar
2. Init lee la sesión de Supabase y carga el perfil de la tabla `usuarios`
3. Suscribe al evento `onAuthStateChange` para reaccionar a login/logout
4. `ProtectedRoute` redirige a /login si no hay sesión

## Convenciones

- Imports con alias `@/` (configurado en vite + tsconfig)
- snake_case para tablas y columnas (Postgres) ↔ camelCase para variables JS
- Cada módulo es autocontenido en su carpeta
