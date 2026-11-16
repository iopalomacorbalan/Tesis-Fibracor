import type { KeyboardEvent } from "react";

/**
 * Herramientas y equipos especiales se cuentan en unidades enteras.
 * Materiales y consumos pueden llevar decimales (metros de cable, litros, kilos).
 */
export function categoriaEntera(categoria?: string | null): boolean {
  return categoria === "Herramienta" || categoria === "Equipo especial";
}

/** Para onKeyDown de un campo numérico: no deja escribir punto ni coma. */
export function soloEnteros(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === "." || e.key === ",") e.preventDefault();
}

/** Lee el valor de un campo como entero o decimal, según corresponda. 0 si está vacío. */
export function leerCantidad(valor: string, entera: boolean): number {
  return (entera ? parseInt(valor, 10) : parseFloat(valor)) || 0;
}
