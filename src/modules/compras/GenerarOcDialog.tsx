import { useState, useEffect } from "react";
import { Loader2, ShoppingCart, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useProveedores } from "@/modules/crm/proveedores/useProveedores";
import { useCrearOcDesdePendientes } from "./useItemsPendientesOc";
import type { ItemPendienteOc } from "./useItemsPendientesOc";
import { formatCurrency } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ItemPendienteOc[]; // los que se seleccionaron
}

interface ItemEditable {
  solicitud_item_id: string;
  item_id: string | null;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio_unitario: number;
}

export function GenerarOcDialog({ open, onOpenChange, items }: Props) {
  const { data: proveedores = [] } = useProveedores();
  const crear = useCrearOcDesdePendientes();

  const [proveedorId, setProveedorId] = useState<string>("");
  const [observaciones, setObservaciones] = useState("");
  const [itemsEdit, setItemsEdit] = useState<ItemEditable[]>([]);

  useEffect(() => {
    if (open && items.length > 0) {
      setItemsEdit(items.map(it => ({
        solicitud_item_id: it.solicitud_item_id,
        item_id: it.item_id,
        descripcion: it.item_descripcion ?? it.descripcion_libre ?? "(sin descripción)",
        cantidad: Number(it.cantidad),
        unidad: it.unidad ?? "ud.",
        precio_unitario: 0,
      })));
      setProveedorId("");
      setObservaciones("");
    }
  }, [open, items]);

  const total = itemsEdit.reduce((s, it) => s + (it.cantidad * it.precio_unitario), 0);

  const handleEditar = (idx: number, patch: Partial<ItemEditable>) => {
    setItemsEdit(itemsEdit.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };

  // Sugerir obra: si todos los items son de la misma obra, usar esa
  const obraSugerida = (() => {
    const obras = [...new Set(items.map(it => it.obra_id).filter(Boolean))];
    return obras.length === 1 ? obras[0] : null;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proveedorId) {
      toast.error("Seleccioná un proveedor");
      return;
    }
    if (itemsEdit.some(it => it.precio_unitario <= 0)) {
      toast.error("Todos los ítems deben tener precio");
      return;
    }
    try {
      const oc = await crear.mutateAsync({
        proveedor_id: proveedorId,
        obra_id: obraSugerida,
        observaciones: observaciones || null,
        items: itemsEdit.map(it => ({
          solicitud_item_id: it.solicitud_item_id,
          item_id: it.item_id,
          descripcion: it.descripcion,
          cantidad: it.cantidad,
          precio_unitario: it.precio_unitario,
        })),
      });
      toast.success(`OC ${oc.compra_id} generada con ${itemsEdit.length} ítem(s)`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Generar orden de compra
          </DialogTitle>
          <DialogDescription>
            Agrupando <b>{itemsEdit.length}</b> ítem(s) pendientes en una sola OC
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Proveedor */}
          <div className="space-y-2">
            <Label>Proveedor *</Label>
            <SearchableSelect
              value={proveedorId || null}
              onChange={(v) => setProveedorId(v ?? "")}
              placeholder="Seleccionar proveedor..."
              options={proveedores.map(p => ({
                value: p.id,
                label: p.nombre,
                searchText: p.cuit ?? "",
              }))}
            />
          </div>

          {/* Items con precio editable */}
          <div className="space-y-2">
            <Label>Ítems a comprar</Label>
            <div className="space-y-2">
              {itemsEdit.map((it, idx) => (
                <div key={it.solicitud_item_id} className="rounded-md border p-3 bg-secondary/20">
                  <div className="font-medium text-sm break-words">{it.descripcion}</div>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div>
                      <Label className="text-[10px]">Cantidad</Label>
                      <Input
                        type="number" min="0.01" step="0.01"
                        value={it.cantidad}
                        onChange={(e) => handleEditar(idx, { cantidad: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">Unidad</Label>
                      <Input
                        value={it.unidad}
                        onChange={(e) => handleEditar(idx, { unidad: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">Precio unit. $ *</Label>
                      <Input
                        type="number" min="0" step="0.01"
                        value={it.precio_unitario || ""}
                        onChange={(e) => handleEditar(idx, { precio_unitario: parseFloat(e.target.value) || 0 })}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div className="text-xs text-right mt-1">
                    Subtotal: <b>{formatCurrency(it.cantidad * it.precio_unitario)}</b>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-sm text-muted-foreground">Total estimado:</span>
              <span className="text-xl font-bold text-primary">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Observaciones */}
          <div className="space-y-2">
            <Label>Observaciones</Label>
            <Textarea
              rows={2}
              placeholder="Notas para esta OC (opcional)..."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </div>

          {obraSugerida && (
            <div className="rounded-md bg-primary/10 border border-primary/30 p-2 text-xs flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              <span>Todos los ítems son de la misma obra. La OC se vinculará automáticamente.</span>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={crear.isPending}>
              {crear.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <ShoppingCart className="h-4 w-4" />
              Generar OC
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
