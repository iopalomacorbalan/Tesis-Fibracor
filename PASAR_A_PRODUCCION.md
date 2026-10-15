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

| 2 | `sql/063_diagnostico_datos_vacios.sql` | **Solo lectura.** Informe de campos vacíos por tabla. Correrlo ANTES de subir la app, para saber qué datos viejos completar | ⬜ |

| 3 | `sql/064_obra_historial.sql` | Tabla `obra_historial` + trigger que registra creación y cambios de estado de obras + carga la creación de las obras existentes | ⬜ |

> `sql/crear_tecnico.sql` se corrigió (ahora completa `user_id`), pero no hay que correrlo:
> es un script de uso manual, reemplazado por el módulo Usuarios.

## 2. Edge Functions (proyecto REAL → Edge Functions)

| Función | Archivo | Probado en pruebas |
|---------|---------|--------------------|
| `gestionar-usuarios` | `supabase/functions/gestionar-usuarios/index.ts` | ⬜ |

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
- Depende de: SQL 064

---

## Checklist después de subir a producción
- [ ] Crear un técnico de prueba desde **Administración → Usuarios**
- [ ] Iniciar sesión con ese técnico y verificar que solo ve sus módulos
- [ ] Asignarlo a una obra y verificar que aparece el aviso de WhatsApp
- [ ] Desactivar el técnico de prueba
