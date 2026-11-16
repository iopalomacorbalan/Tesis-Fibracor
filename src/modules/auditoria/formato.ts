/**
 * Formato legible del detalle de Auditoría: etiquetas en castellano, fechas y montos formateados,
 * y los datos puramente técnicos (ids, fechas de sistema) fuera de la vista principal.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SOLO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const FECHA_HORA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const SOLO_HORA = /^(\d{2}):(\d{2})(:\d{2})?$/;
const MONEDA = /(presupuesto|precio|monto|total|costo|saldo|importe)/;

/** Campos de sistema que no le dicen nada a una persona. */
const TECNICOS = new Set(["id", "created_at", "updated_at", "created_by", "updated_by", "user_id", "firma_imagen", "firma_token", "storage_path"]);

/** Etiqueta y orden de los campos más comunes. Lo que no figura se muestra con el nombre "humanizado". */
const ETIQUETAS: Record<string, string> = {
  obra_id: "Código de obra", nombre_obra: "Nombre de la obra", estado: "Estado", sitio: "Sitio",
  maps_url: "Ubicación", presupuesto: "Presupuesto", alcance_tecnico: "Alcance",
  fecha_inicio_est: "Inicio estimado", fecha_fin_est: "Fin estimado", fecha_inicio_real: "Inicio real", fecha_fin_real: "Fin real",
  remito_id: "Código de remito", compra_id: "Código de compra", item_id: "Código del ítem",
  nombre: "Nombre", descripcion: "Descripción", categoria: "Categoría", unidad: "Unidad", area: "Área",
  cuit: "CUIT", contacto: "Contacto", email: "Email", telefono: "Teléfono", direccion: "Dirección",
  moneda: "Moneda", tipo: "Tipo", monto: "Monto", fecha: "Fecha",
  recibido_por: "Recibido por", dni_receptor: "DNI del receptor", fecha_recepcion: "Fecha de recepción",
  stock_disponible: "Stock disponible", stock_minimo: "Stock mínimo", stock_fuera_servicio: "Fuera de servicio",
  precio_costo: "Precio de costo", precio_lista: "Precio de lista", ubicacion_fisica: "Ubicación en pañol",
  numero_serie: "Número de serie", codigo_barras: "Código de barras", activo: "Activo",
  observaciones: "Observaciones", notas: "Notas", recomendaciones: "Recomendaciones",
  reporte_id: "Código de reporte", solicitud_id: "Código de solicitud", mov_id: "Código de movimiento",
  trabajos_realizados: "Trabajos realizados", pendientes: "Pendientes", hora_entrada: "Hora de entrada", hora_salida: "Hora de salida",
  cantidad: "Cantidad", cantidad_solicitada: "Cantidad pedida", cantidad_recibida: "Cantidad recibida", precio_unitario: "Precio unitario",
  prioridad: "Prioridad", descripcion_libre: "Descripción", caption: "Epígrafe", estado_herramienta: "Estado de la herramienta",
  fecha_solicitud: "Fecha de solicitud", fecha_atencion: "Fecha de atención",
};
const ORDEN = Object.keys(ETIQUETAS);

function humanizar(clave: string): string {
  const t = clave.replace(/_id$/, "").replace(/_/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export const etiqueta = (clave: string) => ETIQUETAS[clave] ?? humanizar(clave);

/** ¿Es un dato de sistema (id, fecha de creación, referencia a otro registro)? */
export const esTecnico = (clave: string, valor: unknown) =>
  TECNICOS.has(clave) || (typeof valor === "string" && UUID.test(valor));

/** Ordena las claves: primero las conocidas (en el orden de arriba), después el resto. */
export function ordenar(claves: string[]): string[] {
  const pos = (k: string) => { const i = ORDEN.indexOf(k); return i === -1 ? ORDEN.length : i; };
  return [...claves].sort((a, b) => pos(a) - pos(b));
}

export interface ValorFormateado { texto: string; enlace?: string }

export function formatear(clave: string, v: unknown): ValorFormateado {
  if (v === null || v === undefined || v === "") return { texto: "—" };
  if (typeof v === "boolean") return { texto: v ? "Sí" : "No" };
  if (typeof v === "number") {
    return MONEDA.test(clave)
      ? { texto: "$ " + v.toLocaleString("es-AR", { maximumFractionDigits: 2 }) }
      : { texto: v.toLocaleString("es-AR") };
  }
  if (Array.isArray(v)) return { texto: v.length ? v.join(", ") : "—" };
  if (typeof v === "object") return { texto: JSON.stringify(v) };
  const s = String(v);
  if (/^https?:\/\//i.test(s)) return { texto: /google\.[^/]+\/maps|goo\.gl|maps\.app/i.test(s) ? "Ver en el mapa" : "Abrir enlace", enlace: s };
  const f = s.match(SOLO_FECHA);
  if (f) return { texto: `${f[3]}/${f[2]}/${f[1]}` };            // sin pasar por Date: evita el corrimiento por zona horaria
  if (FECHA_HORA.test(s)) return { texto: new Date(s).toLocaleString("es-AR") };
  const h = s.match(SOLO_HORA);
  if (h) return { texto: `${h[1]}:${h[2]}` };
  return { texto: s };
}
