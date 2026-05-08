import { useState, useRef, useEffect } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchableOption {
  value: string;
  label: string;        // Texto principal (descripción)
  searchText?: string;  // Texto adicional buscable (ej: SKU, serie)
  hint?: string;        // Texto secundario que se muestra a la derecha (ej: "5 disp.")
}

interface Props {
  options: SearchableOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  allowClear?: boolean;
  className?: string;
}

export function SearchableSelect({
  options, value, onChange, placeholder = "Seleccionar...",
  emptyText = "No se encontraron resultados",
  disabled, allowClear = false, className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find(o => o.value === value) ?? null;

  // Cerrar al click fuera
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Auto focus en search al abrir
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [open]);

  const filtered = query
    ? options.filter(o => {
        const q = query.toLowerCase();
        const haystack = `${o.label} ${o.searchText ?? ""}`.toLowerCase();
        return haystack.includes(q);
      })
    : options;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "hover:border-primary/50 transition-colors text-left"
        )}
      >
        <span className={cn("truncate flex-1 min-w-0", !selected && "text-muted-foreground")}>
          {selected ? selected.label : placeholder}
        </span>
        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          {allowClear && selected && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => { e.stopPropagation(); onChange(null); }}
              className="h-5 w-5 rounded-full hover:bg-accent flex items-center justify-center"
            >
              <X className="h-3 w-3" />
            </span>
          )}
          <ChevronDown className={cn("h-4 w-4 opacity-50 transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-md border bg-popover shadow-lg overflow-hidden">
          <div className="p-2 border-b sticky top-0 bg-popover">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar..."
                className="w-full pl-8 pr-2 py-1.5 text-sm rounded-md bg-background border focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                {emptyText}
              </div>
            ) : (
              filtered.map(o => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-start gap-2",
                    value === o.value && "bg-primary/10"
                  )}
                >
                  <Check className={cn(
                    "h-4 w-4 mt-0.5 flex-shrink-0",
                    value === o.value ? "text-primary" : "opacity-0"
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{o.label}</div>
                    {o.searchText && (
                      <div className="text-xs text-muted-foreground truncate">{o.searchText}</div>
                    )}
                  </div>
                  {o.hint && (
                    <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">{o.hint}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
