# Cambios para pasar a producción

Se prueban en **fibracor-pruebas** (Supabase `bippqzutnxjhvktwvxva`) y después
se suben a **Fibracor real**. Respetar el orden: **1. Base de datos → 2. Edge Functions → 3. App**.

> `.env.local` es solo para la compu local y apunta a pruebas. **No se sube.**
> La app real usa sus propias variables de entorno (Vercel), que tienen que seguir
> apuntando al proyecto real.

---

## 1. Base de datos (SQL Editor del proyecto REAL)

| # | Archivo | Qué hace | Probado en pruebas |
|---|---------|----------|--------------------|
| 1 | `sql/062_usuarios_telefono.sql` | Agrega `telefono` a `usuarios` y la función `set_telefono_usuario` | ✅ (aplicado) |
| 2 | `sql/063_diagnostico_datos_vacios.sql` | **Solo lectura.** Informe de campos vacíos por tabla. Correrlo ANTES de subir la app, para saber qué datos viejos completar | ✅ (corrido; en pruebas las 5 obras no tienen técnico) |
| 3 | `sql/064_obra_historial.sql` | Tabla `obra_historial` + trigger que registra creación y cambios de estado de obras + carga la creación de las obras existentes | ✅ (aplicado y probado en la app) |
| 4 | `sql/065_renombrar_historial_cambios_obras.sql` | Renombra `obra_historial` a `historial_cambios_obras` (índice, política y funciones). Correr después del 064 | ✅ (aplicado y probado en la app) |
| 5 | `sql/066_catalogo_unidades.sql` | Diagnóstico de unidades fuera del catálogo + CHECK (NOT VALID) en `inventario.unidad` y `remito_items.unidad` | ⏳ (pendiente de aplicar en pruebas) |
| 6 | `sql/067_auditoria.sql` | Tabla `auditoria` (solo lectura para Dirección) + trigger genérico `auditar_cambio` en obras, remitos, compras, inventario, caja_chica, clientes, proveedores y usuarios | ✅ (aplicado y probado en la app) |
| 7 | `sql/068_rubros.sql` | Tablas `rubros` y `proveedor_rubros` (cada rubro una sola vez), pasa los rubros actuales de `proveedores.rubros`, y la función `set_rubros_proveedor`. **No borra** la columna vieja `proveedores.rubros` | ⏳ (pendiente de aplicar en pruebas) |
| 8 | `sql/069_tablero_control.sql` | Función `get_tablero_control()` con los indicadores del tablero del Dashboard (solo Dirección, Contabilidad y Operaciones). Usa `get_herramientas_obra` y `get_herramientas_personales`, que ya tienen que existir | ⏳ (pendiente de aplicar en pruebas) |

> **Después de desplegar la app con el 068 funcionando**, la columna `proveedores.rubros` queda sin uso y se puede eliminar:
> `ALTER TABLE public.proveedores DROP COLUMN rubros;` (antes, quitar ese campo del diagnóstico 063).

> `sql/crear_tecnico.sql` se corrigió (ahora completa `user_id`), pero no hay que correrlo:
> es un script de uso manual, reemplazado por el módulo Usuarios.

## 2. Edge Functions (proyecto REAL → Edge Functions)

| Función | Archivo | Probado en pruebas |
|---------|---------|--------------------|
| `gestionar-usuarios` | `supabase/functions/gestionar-usuarios/index.ts` | 🟡 (desplegada, falta probar desde la app) |

⚠️ El nombre tiene que quedar exacto: la URL de la función debe terminar en
`/functions/v1/gestionar-usuarios`. Por terminal:

```
npx supabase login
npx supabase functions deploy gestionar-usuarios --project-ref <REF_DEL_PROYECTO_REAL> --use-api
```

Si falla con `failed to parse environment file ... unexpected character`, el `.env.local`
quedó guardado con BOM: abrirlo en VS Code → abajo a la derecha "UTF-8 with BOM" →
"Save with Encoding" → "UTF-8".

## 3. App (código; se publica con el deploy de Vercel)

### Avisos por WhatsApp al asignar técnicos

> 📱 **Avisar al cliente — número de WhatsApp:** la app NO necesita un número configurado.
> El mensaje sale desde el WhatsApp de quien toca "Enviar" (su celular o WhatsApp Web).
> **Recomendación:** que Fibracor use un número de la empresa con **WhatsApp Business**
> (app gratuita) en la compu/celular de quien asigna obras, para que los técnicos reciban
> siempre los avisos desde el mismo número y no desde celulares personales.
> Un número dedicado solo es obligatorio si a futuro se quiere envío 100% automático
> (WhatsApp Cloud API de Meta: cuenta Business verificada + plantilla de mensaje aprobada).
> Los técnicos tienen que tener cargado su celular en **Administración → Usuarios**.

- Nuevo: `src/lib/whatsapp.ts`, `src/modules/obras/AvisarWhatsAppDialog.tsx`
- Modificado: `src/modules/obras/ObraDialog.tsx`, `src/modules/obras/ObraDetalle.tsx`, `src/types/database.ts`
- Depende de: SQL 062

### Módulo Usuarios (alta de técnicos desde la app)
- Nuevo: `src/modules/usuarios/` (`UsuariosPage.tsx`, `UsuarioDialog.tsx`, `useGestionUsuarios.ts`)
- Modificado: `src/App.tsx` (ruta `/usuarios`), `src/components/layout/Sidebar.tsx` (menú)
- Depende de: SQL 062 + Edge Function `gestionar-usuarios`

### Bloqueo de módulos por área (los técnicos no entran por URL a lo que no ven en el menú)
- Modificado: `src/components/layout/ProtectedRoute.tsx`, `src/components/layout/Sidebar.tsx`

### Campos numéricos: no queda el 0 adelante al escribir
Los campos de cantidad/precio/monto se muestran vacíos cuando valen 0 (antes, al
escribir "5" quedaba "05" o "0,05").
- Modificado: `ObraDialog.tsx` (presupuesto), `stock/ItemDialog.tsx`, `stock/AjusteDialog.tsx`,
  `stock/ReactivarDialog.tsx`, `compras/CompraDialog.tsx`, `compras/GenerarOcDialog.tsx`,
  `compras/RecibirCompraDialog.tsx`, `remitos/RemitoDialog.tsx`, `solicitudes/SolicitudDialog.tsx`,
  `asignaciones-personales/AsignarPersonalDialog.tsx`, `asignaciones-personales/DevolucionPersonalDialog.tsx`,
  `mis-herramientas/MisHerramientasPage.tsx`
- Sin dependencias (solo app)

### Campos obligatorios: no se guardan datos vacíos
| Formulario | Ahora obligatorio | Sigue opcional |
|---|---|---|
| Obra | cliente, nombre, sitio, alcance, inicio, fin (≥ inicio), jefe de obra, ≥1 técnico, presupuesto > 0 (si ve precios) | link de Maps, observaciones |
| Cliente | nombre, CUIT válido, contacto, email, teléfono, dirección | notas, recomendaciones |
| Proveedor | nombre, CUIT válido, contacto, email, teléfono, dirección, ≥1 rubro | notas |
| Ítem de stock | descripción, categoría, unidad, ubicación, proveedor, costo > 0 (si ve precios), N° de serie (solo Equipo especial) | código de barras, precio lista, stock mínimo |

- El "+" de cliente en Nueva obra ahora abre el alta completa (antes creaba el cliente solo con el nombre).
- Modificado: `obras/schemas.ts`, `obras/ObraDialog.tsx`, `crm/clientes/schemas.ts`, `crm/clientes/ClienteDialog.tsx`,
  `crm/proveedores/schemas.ts`, `crm/proveedores/ProveedorDialog.tsx`, `stock/schemas.ts`, `stock/ItemDialog.tsx`
- ⚠️ Impacto en datos viejos: al **editar** un registro existente con vacíos, la app va a pedir completarlo
  antes de guardar. Correr antes el diagnóstico 063 para saber cuántos son.

### Nuevo detalle de obra (ficha, progreso, cambiar estado, historial)
Pestaña "Resumen" del detalle con la estructura del diseño de referencia y el estilo actual de la app:
ficha (cliente, jefe, fechas, sitio, presupuesto) con lápiz para editar · barra de progreso por etapa
(en ejecución se estima por fechas) · panel **Cambiar estado** con el mismo flujo que la lista
(Pendiente OIO → En ejecución → Para cierre → Cerrada; Reabrir solo Dirección) y comentario opcional ·
**Historial de cambios** · accesos rápidos (Ubicación, Reportes, Evidencia, Equipo).
- El detalle dejó de ser un modal: ahora es una **página propia** `/obras/:id` (pantalla completa en
  celular, botón atrás, link directo). Se abre desde la lista de Obras y desde el Calendario.
- El mensaje de WhatsApp incluye el link a la obra (`https://<dominio>/obras/<id>`).
- En la pestaña Reportes del detalle, cada reporte se abre (descripción, trabajos, pendientes y fotos).
- Rediseño de **Exportar PDF** (`src/modules/obras/ExportarObraDialog.tsx`, solo la parte visual; el PDF
  se genera igual): atajos "Para el cliente" / "Informe interno", secciones en tarjetas con interruptor,
  lista de reportes plegable, pie fijo con resumen de lo que incluye y aviso si lleva costos internos.
- Nuevo: `src/modules/obras/ObraResumen.tsx`
- Modificado: `src/modules/obras/ObraDetalle.tsx` (ahora página), `src/modules/obras/useObras.ts`
  (`useObraHistorial`, `comentarCambioEstado`), `src/App.tsx` (ruta `/obras/:id`),
  `src/modules/obras/ObrasPage.tsx`, `src/modules/calendario/CalendarioPage.tsx`, `src/lib/whatsapp.ts`
- Depende de: SQL 064 y 065 (`useObraHistorial` ahora lee `historial_cambios_obras`; `ObraResumen.tsx` actualiza el mensaje de error)

### Catálogo de unidades (selector en vez de texto libre)
- Nuevo: `src/lib/unidades.ts` (lista única), `src/components/ui/unidad-select.tsx`
- Modificado: `remitos/RemitoDialog.tsx` (3 campos), `compras/GenerarOcDialog.tsx`, `stock/ItemDialog.tsx` (usa la lista compartida)
- Un valor viejo fuera del catálogo se sigue mostrando en el selector.
- Depende de: SQL 066

### Módulo Auditoría (solo Dirección)
Lista los últimos 300 altas/modificaciones/bajas con usuario, fecha y el detalle antes → después. Filtros por módulo, acción y búsqueda.
- Nuevo: `src/modules/auditoria/` (`AuditoriaPage.tsx`, `useAuditoria.ts`)
- Modificado: `src/App.tsx` (ruta `/auditoria`), `src/components/layout/Sidebar.tsx` (menú, solo Dirección)
- Depende de: SQL 067

### Rubros de proveedores en tablas
Los rubros se eligen de un catálogo único (sin duplicados por mayúsculas); se pueden agregar nuevos desde el formulario de proveedor.
- Modificado: `crm/proveedores/useProveedores.ts` (lee `proveedor_rubros`, nuevo `useRubros`, guarda con la función `set_rubros_proveedor`), `crm/proveedores/ProveedorDialog.tsx`
- Depende de: SQL 068 (sin el 068, la lista de proveedores no carga)

### Reportes dentro de la obra (ya no es un módulo suelto del menú)
- En el detalle de obra, pestaña **Reportes**, nuevo botón **Nuevo reporte** (abre el mismo formulario con la obra ya elegida).
- "Reportes" se quitó del menú lateral. La ruta `/reportes` sigue existiendo (la usa el Dashboard: "Reportes 7d" y "Ver todos") como lista global para buscar y editar.
- Modificado: `obras/ObraDetalle.tsx`, `components/layout/Sidebar.tsx`
- Sin dependencias (solo app). La tabla `reporte_tecnicos` no cambia: es la relación reporte ↔ técnicos que participaron.

### Tablero de control en el Dashboard (solo Dirección, Contabilidad y Operaciones)
Seis bloques: plata de las obras en curso (presupuesto / costo / margen y obras con margen menor al 10 %), gasto de los últimos
6 meses (compras en pesos + caja chica), materiales que más costo generan, clientes (activos, con obra en curso, repitieron, top 5),
personal técnico del mes (horas, reportes, herramientas a su cargo) y plazos (obras atrasadas, % cerradas a tiempo).
- Nuevo: `src/modules/dashboard/TableroControl.tsx`, `src/modules/dashboard/useTableroControl.ts`
- Modificado: `src/modules/dashboard/DashboardPage.tsx`
- Depende de: SQL 069
- Límites: no hay cobros/facturas en el sistema, por eso "plata" es presupuesto vs. costo; las OC en dólares no entran al gráfico de gasto.

### DNI solo con números en remitos
El campo DNI aceptaba letras. Ahora solo deja números (máximo 8) en el formulario del remito y en la firma pública por QR; la firma pública exige 7 u 8 dígitos.
- Modificado: `remitos/RemitoDialog.tsx`, `firma-publica/FirmaRemitoPage.tsx`
- Sin dependencias (solo app)

### Corrección de errores de TypeScript (sin cambio de comportamiento)
- `calendario/CalendarioPage.tsx`: `EventDropArg` se importa de `@fullcalendar/core`
- `movimientos/MovimientosPage.tsx` y `stock/HistorialDialog.tsx`: faltaban los 3 tipos de movimiento personales (antes mostraban el tipo sin etiqueta/icono)
- `reportes/useReportes.ts`: el `patch` de edición acepta `hora_entrada` / `hora_salida`
- Sin dependencias (solo app)

---

## Checklist después de subir a producción
- [ ] Crear un técnico de prueba desde **Administración → Usuarios**
- [ ] Iniciar sesión con ese técnico y verificar que solo ve sus módulos
- [ ] Asignarlo a una obra y verificar que aparece el aviso de WhatsApp
- [ ] Desactivar el técnico de prueba
