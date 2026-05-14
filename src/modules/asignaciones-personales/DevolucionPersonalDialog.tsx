import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { useSolicitarDevolucionPersonal, useAceptarDevolucionPersonal } from "./useAsignacionesPersonales";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tecnicoId: string;
  tecnicoNombre: string;
  itemId: string;
  itemNombre: string;
  cantidadEnPoder: number;
}

export function DevolucionPersonalDialog({
  open, onOpenChange, tecnicoId, tecnicoNombre, itemId, itemNombre, cantidadEnPoder,
}: Props) {
  const { profile } = useAuth();
  const [cantidad, setCantidad] = useState(cantidadEnPoder);
  const [motivo, setMotivo] = useState("");
  const solicitar = useSolicitarDevolucionPersonal();
  const aceptar = useAceptarDevolucionPersonal();

  // Si soy pañol/operaciones/dirección puedo aceptar directamente (sin pendiente)
  const puedeAceptarDirecto = profile && ["Paniol", "Direccion", "Operaciones"].includes(profile.area);

  const handleSolicitar = async () => {
    if (cantidad <= 0 || cantidad > cantidadEnPoder) {
      toast.error(`Cantidad debe estar entre 0.01 y ${cantidadEnPoder}`);
      return;
    }
    try {
      await solicitar.mutateAsync({
        tecnico_id: tecnicoId,
        item_id: itemId,
        cantidad,
        motivo: motivo || undefined,
      });
      toast.success("Solicitud de devolución registrada");
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  const handleAceptarDirecto = async () => {
    if (cantidad <= 0 || cantidad > cantidadEnPoder) {
      toast.error(`Cantidad debe estar entre 0.01 y ${cantidadEnPoder}`);
      return;
    }
    try {
      await aceptar.mutateAsync({
        tecnico_id: tecnicoId,
        item_id: itemId,
        cantidad,
        observaciones: motivo || undefined,
      });
      toast.success("Devolución registrada — stock actualizado");
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Devolución de {itemNombre}</DialogTitle>
          <DialogDescription>
            Técnico: <b>{tecnicoNombre}</b> · En poder: <b>{cantidadEnPoder}</b>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Cantidad a devolver</Label>
            <Input
              type="number"
              min="0.01"
              max={cantidadEnPoder}
              step="0.01"
              value={cantidad}
              onChange={(e) => setCantidad(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="space-y-2">
            <Label>Motivo / Observaciones (opcional)</Label>
            <Textarea
              rows={2}
              placeholder="Ej: se rompió, desgastada, ya no la necesita..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {puedeAceptarDirecto && (
            <Button
              variant="default"
              onClick={handleAceptarDirecto}
              disabled={aceptar.isPending || solicitar.isPending}
            >
              {aceptar.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Recibir ahora
            </Button>
          )}
          <Button
            variant={puedeAceptarDirecto ? "outline" : "default"}
            onClick={handleSolicitar}
            disabled={solicitar.isPending || aceptar.isPending}
          >
            {solicitar.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Solo solicitar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
