import { useState } from "react";
import { Loader2, CheckCircle, ShoppingCart, Package, AlertCircle, Briefcase, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useEntregarItem, useCambiarEstadoItem } from "./useSolicitudes";
import { useAuth } from "@/lib/auth";
import { cn, formatDate } from "@/lib/utils";
import type { SolicitudConRelaciones, EstadoItemSol } from "@/types/database";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  solicitud: SolicitudConRelaciones | null;
}

const ESTADO_ITEM_INFO: Record<EstadoItemSol, { label: string; color: string }> = {
  "pendiente": { label: "Pendiente", color: "bg-warning/15 text-warning border-warning/30" },
  "en_oc":     { label: "En OC", color: "bg-primary/15 text-primary border-primary/30" },
  "listo":     { label: "Listo p/entregar", color: "bg-success/15 text-success border-success/30" },
  "entregado": { label: "✓ Entregado", color: "bg-success/15 text-success border-success/30" },
  "cancelado": { label: "Cancelado", color: "bg-muted text-muted-foreground" },
};

export function SolicitudDetalle({ open, onOpenChange, solicitud }: Props) {
  const { profile } = useAuth();
  const entregar = useEntregarItem();
  const cambiar = useCambiarEstadoItem();

  const [procesandoId, setProcesandoId] = useState<string | null>(null);

  if (!solicitud) return null;

  const esPaniol = profile && ["Direccion", "Operaciones", "Paniol"].includes(profile.area);

  const handleEntregar = async (item: any) => {
    if (!item.item_id) {
      toast.error("Este ítem es manual (sin link a inventario). Marcalo como 'En OC' o cancelá.");
      return;
    }
    const inv = item.item;
    if (inv && inv.stock_disponible < item.cantidad) {
      toast.error(`Stock insuficiente: hay ${inv.stock_disponible}, se pidió ${item.cantidad}`);
      return;
    }
    setProcesandoId(item.id);
    try {
      await entregar.mutateAsync({
        solicitudItemId: item.id,
        itemInventarioId: item.item_id,
        cantidad: item.cantidad,
        obraId: solicitud.obra_id,
        tecnicoId: solicitud.tecnico_id,
        observaciones: `Entrega solicitud ${solicitud.solicitud_id}`,
      });
      toast.success(`Entregado: ${item.cantidad} ${item.unidad} de ${inv?.descripcion ?? "ítem"}`);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    } finally {
      setProcesandoId(null);
    }
  };

  const handleEstadoChange = async (itemId: string, nuevoEstado: EstadoItemSol) => {
    setProcesandoId(itemId);
    try {
      await cambiar.mutateAsync({ itemId, estado: nuevoEstado });
      toast.success("Estado actualizado");
    } catch (e: any) {
      toast.error("Error: " + e.message);
    } finally {
      setProcesandoId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Solicitud {solicitud.solicitud_id}</DialogTitle>
          <DialogDescription>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs mt-1">
              {solicitud.obra && (
                <span><Briefcase className="inline h-3 w-3 mr-1" />{solicitud.obra.obra_id}</span>
              )}
              {solicitud.tecnico && (
                <span><User className="inline h-3 w-3 mr-1" />{solicitud.tecnico.nombre}</span>
              )}
              <span>📅 {formatDate(solicitud.fecha_solicitud)}</span>
              <span>⚡ {solicitud.prioridad}</span>
            </div>
          </DialogDescription>
        </DialogHeader>

        {solicitud.observaciones && (
          <div className="rounded-md bg-secondary/50 p-3 text-sm">
            <div className="text-xs text-muted-foreground mb-1">Observaciones:</div>
            <div className="italic">"{solicitud.observaciones}"</div>
          </div>
        )}

        <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-2">
          <div className="text-sm font-medium mb-1">
            Ítems ({solicitud.items?.length ?? 0}):
          </div>
          {(solicitud.items ?? []).map(it => {
            const inv = (it as any).item;
            const estadoInfo = ESTADO_ITEM_INFO[it.estado];
            const stockOk = !inv || inv.stock_disponible >= it.cantidad;
            const procesando = procesandoId === it.id;
            const esEntregable = esPaniol && it.estado !== "entregado" && it.estado !== "cancelado";

            return (
              <div key={it.id} className="rounded-md border p-3 space-y-2">
                <div className="flex justify-between items-start flex-wrap gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">
                      {inv?.descripcion ?? it.descripcion_libre ?? "(sin descripción)"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {inv ? <>{inv.item_id} · </> : "📝 Manual · "}
                      <b className="text-foreground">{it.cantidad}</b> {it.unidad}
                      {inv && (
                        <> · Stock: <b className={stockOk ? "text-success" : "text-destructive"}>{inv.stock_disponible}</b></>
                      )}
                    </div>
                  </div>
                  <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold border", estadoInfo.color)}>
                    {estadoInfo.label}
                  </span>
                </div>

                {esEntregable && (
                  <div className="flex gap-1 flex-wrap pt-2 border-t">
                    {inv && stockOk && it.estado !== "listo" && (
                      <Button
                        size="sm" variant="success"
                        onClick={() => handleEntregar(it)}
                        disabled={procesando}
                      >
                        {procesando ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                        Entregar del stock
                      </Button>
                    )}
                    {inv && !stockOk && (
                      <span className="text-xs text-destructive flex items-center gap-1 px-2">
                        <AlertCircle className="h-3 w-3" /> Stock insuficiente
                      </span>
                    )}
                    {it.estado !== "en_oc" && (
                      <Button
                        size="sm" variant="outline"
                        onClick={() => handleEstadoChange(it.id, "en_oc")}
                        disabled={procesando}
                      >
                        <ShoppingCart className="h-3 w-3" /> Marcar en OC
                      </Button>
                    )}
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => handleEstadoChange(it.id, "cancelado")}
                      disabled={procesando}
                      className="text-destructive"
                    >
                      Cancelar ítem
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
