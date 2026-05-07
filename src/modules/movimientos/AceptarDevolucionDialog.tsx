import { useState, useEffect } from "react";
import { Loader2, CheckCircle, AlertTriangle, Wrench, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useAceptarDevolucion } from "./useMovimientos";
import type { MovimientoConRelaciones } from "@/types/database";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  movimiento: MovimientoConRelaciones | null;
}

const ESTADOS = [
  { value: "Bueno", label: "Buena condición", icon: CheckCircle, color: "text-success", desc: "Vuelve a stock disponible" },
  { value: "Dañada", label: "Dañada", icon: AlertTriangle, color: "text-destructive", desc: "Va a fuera de servicio" },
  { value: "Necesita mantenimiento", label: "Necesita mantenimiento", icon: Wrench, color: "text-warning", desc: "Va a fuera de servicio" },
  { value: "Cancelado", label: "Cancelar (error de carga)", icon: XCircle, color: "text-muted-foreground", desc: "Sin cambios en inventario" },
];

export function AceptarDevolucionDialog({ open, onOpenChange, movimiento }: Props) {
  const aceptar = useAceptarDevolucion();
  const [estado, setEstado] = useState("Bueno");
  const [obs, setObs] = useState("");

  useEffect(() => {
    if (open) {
      setEstado("Bueno");
      setObs("");
    }
  }, [open]);

  if (!movimiento) return null;

  const handleSubmit = async () => {
    try {
      await aceptar.mutateAsync({
        mov_pendiente_id: movimiento.id,
        estado_recibido: estado,
        observaciones: obs,
      });
      toast.success("Devolución procesada correctamente");
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  const item = (movimiento as any).item;
  const tecnico = (movimiento as any).tecnico;
  const obra = (movimiento as any).obra;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Procesar devolución</DialogTitle>
          <DialogDescription>
            <span className="font-medium">{item?.descripcion ?? "Ítem"}</span>
            <br />
            <span className="text-xs">
              {item?.item_id} · <b>{movimiento.cantidad}</b> {item?.unidad ?? "ud."}
              {tecnico && <> · de {tecnico.nombre}</>}
              {obra && <> · {obra.obra_id}</>}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>Estado de la herramienta recibida *</Label>
          <div className="space-y-2">
            {ESTADOS.map(e => {
              const Icon = e.icon;
              const sel = estado === e.value;
              return (
                <button
                  key={e.value}
                  type="button"
                  onClick={() => setEstado(e.value)}
                  className={`w-full flex items-center gap-3 p-3 rounded-md border transition-colors text-left ${
                    sel ? "border-primary bg-primary/5" : "hover:bg-accent"
                  }`}
                >
                  <Icon className={`h-5 w-5 flex-shrink-0 ${e.color}`} />
                  <div>
                    <div className="font-medium text-sm">{e.label}</div>
                    <div className="text-xs text-muted-foreground">{e.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Observaciones</Label>
          <Textarea
            rows={2}
            placeholder="Detalles del estado, novedades..."
            value={obs}
            onChange={(e) => setObs(e.target.value)}
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={aceptar.isPending}>
            {aceptar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
