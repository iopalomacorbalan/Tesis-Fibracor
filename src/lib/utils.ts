import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  // Fechas tipo "YYYY-MM-DD" (columnas DATE) se parsean como fecha local
  // para evitar el corrimiento de un día por zona horaria (UTC-3).
  if (typeof d === "string") {
    const soloFecha = d.slice(0, 10);
    const m = soloFecha.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const [, yy, mm, dd] = m;
      return `${dd}/${mm}/${yy}`;
    }
  }
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatCurrency(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}
