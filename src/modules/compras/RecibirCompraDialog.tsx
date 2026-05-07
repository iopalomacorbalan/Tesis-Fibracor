import { useState, useEffect } from "react";
import { Loader2, Package, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useRecibirItemCompra } from "./useCompras";
import { cn } from "@/lib/utils";
import type { CompraConRelaciones } from "@/types/database";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  compra: CompraConRelaciones | null;
}

export function RecibirCompraDialog({ open, onOpenChange, compra }: Props) {
  const recibir = useRecibirItemCompra();
  // Map item_id (compra_item.id) -> cantidad a recibir en este momento
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [procesando, setProcesando] = useState<string | null>(null);

  useEffect(() => {
    if (open && compra) {
      const init: Record<string, number> = {};
      (compra.items ?? []).forEach(it => {
        const pendiente = it.cantidad_solicitada - it.cantidad_recibida;
        init[it.id] = pendiente;
      });
      setCantidades(init);
    }
  }, [open, compra]);

  if (!compra) return null;

  const handleRecibirItem = async (itemId: string) => {
    const item = compra.items?.find(it => it.id === itemId);
    if (!item) return;
    const cantidad = cantidades[itemId] ?? 0;
    if (cantidad <= 0) {
      toast.error("Cantidad debe ser > 0");
      return;
    }
    const pendiente = item.cantidad_solicitada - item.cantidad_recibida;
    if (cantidad > pendiente) {
      toast.error(`Pendiente máximo: ${pendiente}`);
      return;
    }
    setProcesando(itemId);
    try {
      await recibir.mutateAsync({
        compra_item_id: item.id,
        cantidad_recibida: cantidad,
        item_inventario_id: item.item_id,
        precio_unitario: item.precio_unitario,
        compra_id: compra.id,
      });
      toast.success(`Recibido: ${cantidad} de ${item.descripcion}`);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    } finally {
      setProcesando(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Recibir mercadería — {compra.compra_id}</DialogTitle>
          <DialogDescription>
            <b>{compra.proveedor?.nombre}</b>
            {compra.obra && <> · Obra {compra.obra.obra_id}</>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-2">
          {(compra.items ?? []).map(it => {
            const inv = (it as any).item;
            const pendiente = it.cantidad_solicitada - it.cantidad_recibida;
            const completo = pendiente <= 0;
            const proc = procesando === it.id;

            return (
              <div key={it.id} className={cn(
                "rounded-md border p-3 space-y-2",
                completo && "bg-success/5 border-success/30"
              )}>
                <div className="flex justify-between items-start flex-wrap gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">
                      {inv?.descripcion ?? it.descripcion}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {inv?.item_id} ·
                      Solicitado: <b>{it.cantidad_solicitada}</b> ·
                      Recibido: <b className={completo ? "text-success" : ""}>{it.cantidad_recibida}</b> ·
                      Pendiente: <b className={!completo ? "text-warning" : ""}>{pendiente}</b>
                    </div>
                  </div>
                  {completo && <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />}
                </div>

                {!completo && (
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label className="text-[10px]">Cantidad a recibir ahora</Label>
                      <Input
                        type="number"
                        min="0.01" step="0.01"
                        max={pendiente}
                        value={cantidades[it.id] ?? 0}
                        onChange={(e) => setCantidades({
                          ...cantidades,
                          [it.id]: parseFloat(e.target.value) || 0,
                        })}
                        disabled={proc}
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleRecibirItem(it.id)}
                      disabled={proc}
                    >
                      {proc ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Package className="h-3.5 w-3.5" />}
                      Recibir
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
