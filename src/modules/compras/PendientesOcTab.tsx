import { useState, useMemo } from "react";
import { Loader2, ShoppingCart, AlertCircle, Briefcase, User, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useItemsPendientesOc, type ItemPendienteOc } from "./useItemsPendientesOc";
import { GenerarOcDialog } from "./GenerarOcDialog";
import { cn, formatDate } from "@/lib/utils";

export function PendientesOcTab() {
  const { data: items = [], isLoading } = useItemsPendientesOc();
  const [search, setSearch] = useState("");
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [generarDialog, setGenerarDialog] = useState(false);

  const filtrados = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(it =>
      it.item_descripcion?.toLowerCase().includes(q) ||
      it.descripcion_libre?.toLowerCase().includes(q) ||
      it.item_codigo?.toLowerCase().includes(q) ||
      it.solicitud_codigo?.toLowerCase().includes(q) ||
      it.obra_codigo?.toLowerCase().includes(q) ||
      it.tecnico_nombre?.toLowerCase().includes(q)
    );
  }, [items, search]);

  const itemsSeleccionados = items.filter(it => seleccionados.has(it.solicitud_item_id));

  const toggleItem = (id: string) => {
    const next = new Set(seleccionados);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSeleccionados(next);
  };

  const seleccionarTodos = () => {
    setSeleccionados(new Set(filtrados.map(it => it.solicitud_item_id)));
  };

  const limpiarSeleccion = () => {
    setSeleccionados(new Set());
  };

  if (isLoading) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">No hay ítems pendientes de OC</p>
          <p className="text-xs text-muted-foreground mt-1">
            Cuando se marquen ítems en una solicitud como "Marcar en OC", aparecerán acá para agruparlos en una orden de compra.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <Input
          placeholder="Buscar por ítem, solicitud, obra o técnico..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <div className="flex gap-2 flex-wrap">
          {seleccionados.size > 0 ? (
            <>
              <Button variant="ghost" onClick={limpiarSeleccion} size="sm">
                Limpiar ({seleccionados.size})
              </Button>
              <Button onClick={() => setGenerarDialog(true)} size="sm">
                <ShoppingCart className="h-4 w-4" />
                Generar OC ({seleccionados.size})
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={seleccionarTodos} size="sm">
              Seleccionar todos
            </Button>
          )}
        </div>
      </div>

      {filtrados.length === 0 ? (
        <div className="text-center text-muted-foreground py-8 text-sm">
          Sin resultados para "{search}"
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map(it => (
            <ItemPendienteCard
              key={it.solicitud_item_id}
              item={it}
              seleccionado={seleccionados.has(it.solicitud_item_id)}
              onToggle={() => toggleItem(it.solicitud_item_id)}
            />
          ))}
        </div>
      )}

      <GenerarOcDialog
        open={generarDialog}
        onOpenChange={(o) => {
          setGenerarDialog(o);
          if (!o) {
            // si la creación tuvo éxito, limpiar selección
            setSeleccionados(new Set());
          }
        }}
        items={itemsSeleccionados}
      />
    </div>
  );
}

function ItemPendienteCard({
  item, seleccionado, onToggle,
}: {
  item: ItemPendienteOc;
  seleccionado: boolean;
  onToggle: () => void;
}) {
  const stockBajo = item.stock_actual < item.cantidad;

  return (
    <Card
      onClick={onToggle}
      className={cn(
        "cursor-pointer transition-colors",
        seleccionado ? "bg-primary/5 border-primary/50" : "hover:border-primary/30"
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={seleccionado}
            onChange={onToggle}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 h-4 w-4 cursor-pointer accent-primary flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-semibold break-words">
                {item.item_descripcion ?? item.descripcion_libre ?? "(sin descripción)"}
              </span>
              {item.item_codigo && (
                <span className="text-[10px] text-muted-foreground">{item.item_codigo}</span>
              )}
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/15 text-primary border border-primary/30">
                {item.prioridad}
              </span>
            </div>

            <div className="text-xs text-muted-foreground space-y-0.5">
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                <span>📋 Solicitud <b className="text-foreground">{item.solicitud_codigo}</b></span>
                <span>📅 {formatDate(item.fecha_solicitud)}</span>
                {item.tecnico_nombre && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" /> {item.tecnico_nombre}
                  </span>
                )}
                {item.obra_codigo && (
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-3 w-3" /> {item.obra_codigo}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                <span>
                  Cantidad: <b className="text-foreground">{Number(item.cantidad)}</b> {item.unidad}
                </span>
                {item.item_id && (
                  <span className={cn(stockBajo && "text-destructive font-semibold")}>
                    Stock actual: {Number(item.stock_actual)}
                    {stockBajo && (
                      <span className="ml-1 inline-flex items-center gap-0.5">
                        <AlertCircle className="h-3 w-3" />
                        Insuficiente
                      </span>
                    )}
                  </span>
                )}
              </div>
              {item.observaciones && (
                <div className="italic text-muted-foreground/80 mt-1">
                  &ldquo;{item.observaciones}&rdquo;
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
