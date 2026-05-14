/**
 * Helpers de permisos por rol.
 *
 * Regla: Direccion, Contabilidad y Comercial ven precios (presupuestos, costos, márgenes).
 * Tecnico, Paniol y Operaciones NO ven precios.
 *
 * Importante: estos helpers son la primera capa (UX). La seguridad real está en
 * las políticas RLS de Supabase.
 */

export type UserArea =
  | "Direccion"
  | "Operaciones"
  | "Paniol"
  | "Comercial"
  | "Contabilidad"
  | "Tecnico";

const AREAS_CON_PRECIOS: UserArea[] = ["Direccion", "Contabilidad", "Comercial"];

/** ¿Puede ver precios (presupuestos, costos, márgenes)? */
export function puedeVerPrecios(area: string | null | undefined): boolean {
  if (!area) return false;
  return AREAS_CON_PRECIOS.includes(area as UserArea);
}

/**
 * ¿Puede ver/editar precios EN EL CONTEXTO de crear o editar una OC?
 *
 * Excepción: Operaciones necesita cargar precios al generar OCs aunque no
 * los vea en el resto de la app. Esta función se usa SOLO en CompraDialog
 * y GenerarOcDialog.
 */
export function puedeVerPreciosEnOC(area: string | null | undefined): boolean {
  if (!area) return false;
  return [...AREAS_CON_PRECIOS, "Operaciones"].includes(area as UserArea);
}

/** ¿Puede ver el resumen financiero detallado (margen, costos extras)? */
export function puedeVerFinanciero(area: string | null | undefined): boolean {
  // Solo Direccion y Contabilidad ven el detalle completo financiero
  if (!area) return false;
  return ["Direccion", "Contabilidad"].includes(area);
}

/** ¿Puede crear/editar costos extras de una obra? */
export function puedeEditarCostosExtras(area: string | null | undefined): boolean {
  if (!area) return false;
  return ["Direccion", "Operaciones", "Contabilidad"].includes(area);
}

/** ¿Puede aprobar OCs (órdenes de compra)? */
export function puedeAprobarOC(area: string | null | undefined): boolean {
  if (!area) return false;
  return ["Direccion", "Operaciones"].includes(area);
}
