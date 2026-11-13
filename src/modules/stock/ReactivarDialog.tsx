import { useState, useEffect } from "react";
import { Loader2, CheckCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useReactivarHerramienta } from "./useInventario";
import type { Inventario } from "@/types/database";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Inventario | null;
  accion: "reactivar" | "dar_de_baja";
}

export function ReactivarDialog({ open, onOpenChange, item, accion }: Props) {
  const reactivar = useReactivarHerramienta();

  const [cantidad, setCantidad] = useState(0);
  const [observaciones, setObservaciones] = useState("");

  useEffect(() => {
    if (open && item) {
      setCantidad(item.stock_fuera_servicio);
      setObservaciones("");
    }
  }, [open, item]);

  if (!item) return null;

  const esReact = accion === "reactivar";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cantidad <= 0) {
      toast.error("Cantidad inválida");
      return;
    }
    if (cantidad > item.stock_fuera_servicio) {
      toast.error(`Máximo ${item.stock_fuera_servicio} ud. en revisión`);
      return;
    }
    try {
      await reactivar.mutateAsync({
        item_id: item.id,
        cantidad,
        accion,
        observaciones: observaciones || (esReact ? "Reparada" : "Descarte"),
      });
      toast.success(
        esReact
          ? `${cantidad} ud. reincorporadas al stock`
          : `${cantidad} ud. dadas de baja`
      );
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {esReact ? (
              <><CheckCircle className="h-5 w-5 text-success" /> Reincorporar al stock</>
            ) : (
              <><Trash2 className="h-5 w-5 text-destructive" /> Dar de baja</>
            )}
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium">{item.descripcion}</span>
            <br />
            <span className="text-xs">{item.item_id}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md bg-warning/10 border border-warning/30 p-3 text-sm">
          <div className="flex justify-between">
            <span>En revisión / fuera de servicio:</span>
            <span className="font-bold text-warning">{item.stock_fuera_servicio} {item.unidad}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cantidad">Cantidad a {esReact ? "reincorporar" : "dar de baja"} *</Label>
            <Input
              id="cantidad"
              type="number"
              min="0.01"
              max={item.stock_fuera_servicio}
              step="0.01"
              value={cantidad || ""}
              onChange={(e) => setCantidad(parseFloat(e.target.value) || 0)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Máximo: {item.stock_fuera_servicio} {item.unidad}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="obs">Observaciones</Label>
            <Textarea
              id="obs"
              rows={2}
              placeholder={esReact
                ? "Detalles de la reparación, costos asociados..."
                : "Motivo del descarte, destino..."
              }
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button
              type="submit"
              variant={esReact ? "success" : "destructive"}
              disabled={reactivar.isPending}
            >
              {reactivar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {esReact ? "Reincorporar" : "Dar de baja"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
