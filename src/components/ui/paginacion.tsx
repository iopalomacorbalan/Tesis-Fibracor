import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TAMANOS = [10, 25, 50, 100];

export interface ControlesPaginacion {
  pagina: number;
  totalPaginas: number;
  total: number;
  desde: number;
  hasta: number;
  porPagina: number;
  setPagina: (p: number) => void;
  setPorPagina: (n: number) => void;
}

/**
 * Pagina una lista que ya está en memoria (después de buscar y filtrar).
 * `claveReinicio`: texto con los filtros activos; al cambiar, vuelve a la página 1.
 * Los datos que se recargan solos (por ejemplo al editar algo) NO mueven de página.
 */
export function usePaginacion<T>(items: T[], claveReinicio = "", porPaginaInicial = 25) {
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(porPaginaInicial);

  useEffect(() => { setPagina(1); }, [claveReinicio, porPagina]);

  const total = items.length;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const actual = Math.min(pagina, totalPaginas);
  const inicio = (actual - 1) * porPagina;

  const controles: ControlesPaginacion = {
    pagina: actual,
    totalPaginas,
    total,
    desde: total === 0 ? 0 : inicio + 1,
    hasta: Math.min(inicio + porPagina, total),
    porPagina,
    setPagina,
    setPorPagina,
  };

  return { items: items.slice(inicio, inicio + porPagina), controles };
}

function numerosVisibles(actual: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, actual - 1, actual, actual + 1]);
  const orden = [...set].filter(n => n >= 1 && n <= total).sort((a, b) => a - b);
  const res: (number | "…")[] = [];
  orden.forEach((n, i) => {
    if (i > 0 && n - orden[i - 1] > 1) res.push("…");
    res.push(n);
  });
  return res;
}

/** Barra "Mostrando 1–25 de 134 · por página · ‹ 1 2 3 … 6 ›". Si cabe todo en una página, no se muestra. */
export function Paginacion({
  pagina, totalPaginas, total, desde, hasta, porPagina, setPagina, setPorPagina,
}: ControlesPaginacion) {
  if (total <= TAMANOS[0]) return null;

  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm">
      <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
        <span>Mostrando {desde}–{hasta} de {total}</span>
        <label className="flex items-center gap-2">
          <select
            value={porPagina}
            onChange={e => setPorPagina(Number(e.target.value))}
            aria-label="Cantidad por página"
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
          >
            {TAMANOS.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          por página
        </label>
      </div>

      {totalPaginas > 1 && (
        <nav aria-label="Páginas" className="flex items-center gap-1">
          <Button
            variant="outline" size="sm" className="h-8 px-2"
            disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Anterior</span>
          </Button>
          {numerosVisibles(pagina, totalPaginas).map((n, i) =>
            n === "…" ? (
              <span key={`p${i}`} className="px-1 text-muted-foreground">…</span>
            ) : (
              <button
                key={n}
                type="button"
                onClick={() => setPagina(n)}
                aria-current={n === pagina ? "page" : undefined}
                className={cn(
                  "h-8 min-w-8 rounded-md px-2 text-xs transition-colors",
                  n === pagina
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {n}
              </button>
            )
          )}
          <Button
            variant="outline" size="sm" className="h-8 px-2"
            disabled={pagina >= totalPaginas} onClick={() => setPagina(pagina + 1)}
          >
            <span className="hidden sm:inline">Siguiente</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </nav>
      )}
    </div>
  );
}
