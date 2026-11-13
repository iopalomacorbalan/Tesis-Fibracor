import { ArrowDown, ArrowUp, ArrowLeftRight, Wrench, Trash, RotateCcw } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useMovimientosItem } from "./useInventario";
import { formatDate } from "@/lib/utils";
import type { Inventario, TipoMovimiento } from "@/types/database";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Inventario | null;
}

const TIPO_INFO: Record<TipoMovimiento, { label: string; color: string; icon: any; sign: "+" | "-" | "=" }> = {
  "Ingreso_compra":      { label: "Ingreso por compra", color: "text-success", icon: ArrowUp, sign: "+" },
  "Ingreso_inicial":     { label: "Stock inicial", color: "text-success", icon: ArrowUp, sign: "+" },
  "Ajuste_positivo":     { label: "Ajuste +", color: "text-success", icon: ArrowUp, sign: "+" },
  "Ajuste_negativo":     { label: "Ajuste -", color: "text-destructive", icon: ArrowDown, sign: "-" },
  "Retiro":              { label: "Retiro a obra", color: "text-primary", icon: ArrowDown, sign: "-" },
  "Devolucion_pendiente":{ label: "Devolución pendiente", color: "text-warning", icon: ArrowLeftRight, sign: "=" },
  "Devolucion":          { label: "Devolución aceptada", color: "text-success", icon: ArrowUp, sign: "+" },
  "Reactivacion":        { label: "Reactivación", color: "text-success", icon: RotateCcw, sign: "+" },
  "Baja":                { label: "Baja / descarte", color: "text-destructive", icon: Trash, sign: "-" },
  "Transferencia":       { label: "Transferencia", color: "text-primary", icon: ArrowLeftRight, sign: "=" },
  "Asignacion_personal":  { label: "Asignación personal", color: "text-primary", icon: Wrench, sign: "-" },
  "Devolucion_personal_pendiente": { label: "Devolución personal pendiente", color: "text-warning", icon: ArrowLeftRight, sign: "=" },
  "Devolucion_personal": { label: "Devolución personal", color: "text-success", icon: ArrowUp, sign: "+" },
};

export function HistorialDialog({ open, onOpenChange, item }: Props) {
  const { data: movs = [], isLoading } = useMovimientosItem(item?.id);

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Historial — {item.descripcion}</DialogTitle>
          <DialogDescription>
            {item.item_id} · Últimos 100 movimientos
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Cargando movimientos...</div>
        ) : movs.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">Sin movimientos registrados</div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
            {movs.map(m => {
              const info = TIPO_INFO[m.tipo as TipoMovimiento] ?? { label: m.tipo, color: "", icon: ArrowLeftRight, sign: "=" };
              const Icon = info.icon;
              return (
                <div key={m.id} className="flex items-start gap-3 p-3 rounded-md border bg-card">
                  <div className={`h-9 w-9 rounded-md flex items-center justify-center bg-secondary ${info.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <div className="font-medium text-sm">
                        {info.label} <span className="text-xs text-muted-foreground">· {m.mov_id}</span>
                      </div>
                      <div className={`font-bold text-sm ${info.color}`}>
                        {info.sign}{m.cantidad} {item.unidad}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {formatDate(m.fecha)}
                      {(m as any).obra && <> · 🏗 {(m as any).obra.obra_id}</>}
                      {(m as any).tecnico && <> · 👤 {(m as any).tecnico.nombre}</>}
                      {(m as any).ejecutor && <> · ✓ {(m as any).ejecutor.nombre}</>}
                    </div>
                    {m.observaciones && (
                      <div className="text-xs text-muted-foreground mt-1 italic">
                        "{m.observaciones}"
                      </div>
                    )}
                    {m.estado_herramienta && (
                      <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] bg-muted">
                        Estado: {m.estado_herramienta}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
