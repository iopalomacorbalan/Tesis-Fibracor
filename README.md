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

# 2. Verificar que .env.local exista con las credenciales correctas
# (ya viene con las del proyecto fibracor)

# 3. Correr en desarrollo
npm run dev
```

Abrir http://localhost:5173

### Build de producción

```bash
npm run build
npm run preview   # ver localmente
```

El output queda en `dist/`. Se puede subir a Vercel/Netlify directo.

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
