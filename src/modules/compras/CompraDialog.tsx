import { useState, useEffect, useMemo } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useCrearCompra } from "./useCompras";
import { useProveedores } from "@/modules/crm/proveedores/useProveedores";
import { useObras } from "@/modules/obras/useObras";
import { useInventario } from "@/modules/stock/useInventario";
import { formatCurrency } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ItemDraft = {
  item_id: string;
  descripcion: string;
  cantidad_solicitada: number;
  precio_unitario: number;
};

export function CompraDialog({ open, onOpenChange }: Props) {
  const { data: proveedores = [] } = useProveedores();
  const { data: obras = [] } = useObras();
  const { data: items = [] } = useInventario();
  const crear = useCrearCompra();

  const [proveedorId, setProveedorId] = useState<string | null>(null);
  const [obraId, setObraId] = useState<string | null>(null);
  const [observaciones, setObservaciones] = useState("");
  const [itemsDraft, setItemsDraft] = useState<ItemDraft[]>([
    { item_id: "", descripcion: "", cantidad_solicitada: 1, precio_unitario: 0 },
  ]);

  useEffect(() => {
    if (open) {
      setProveedorId(null);
      setObraId(null);
      setObservaciones("");
      setItemsDraft([{ item_id: "", descripcion: "", cantidad_solicitada: 1, precio_unitario: 0 }]);
    }
  }, [open]);

  const obrasActivas = obras.filter(o => ["Pendiente OIO", "En ejecucion"].includes(o.estado));

  const addItem = () => setItemsDraft([
    ...itemsDraft,
    { item_id: "", descripcion: "", cantidad_solicitada: 1, precio_unitario: 0 },
  ]);

  const removeItem = (idx: number) => {
    if (itemsDraft.length === 1) return;
    setItemsDraft(itemsDraft.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, patch: Partial<ItemDraft>) => {
    setItemsDraft(itemsDraft.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };

  const onItemSeleccion = (idx: number, value: string) => {
    const inv = items.find(i => i.id === value);
    updateItem(idx, {
      item_id: value,
      descripcion: inv?.descripcion ?? "",
      precio_unitario: inv?.precio_costo ?? 0,
    });
  };

  const totalCalc = useMemo(
    () => itemsDraft.reduce((s, it) => s + (it.cantidad_solicitada * it.precio_unitario), 0),
    [itemsDraft]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proveedorId) { toast.error("Seleccioná un proveedor"); return; }
    const itemsValid = itemsDraft.filter(it => it.item_id && it.cantidad_solicitada > 0);
    if (itemsValid.length === 0) { toast.error("Agregá al menos un ítem válido"); return; }

    try {
      const oc = await crear.mutateAsync({
        proveedor_id: proveedorId,
        obra_id: obraId,
        observaciones: observaciones || null,
        items: itemsValid,
      });
      toast.success(`Orden ${oc.compra_id} creada`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Nueva orden de compra</DialogTitle>
          <DialogDescription>Crear OC con uno o más ítems</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Proveedor *</Label>
              <Select value={proveedorId ?? ""} onValueChange={(v) => setProveedorId(v || null)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar proveedor..." />
                </SelectTrigger>
                <SelectContent>
                  {proveedores.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Obra (opcional)</Label>
              <Select value={obraId ?? "ninguna"} onValueChange={(v) => setObraId(v === "ninguna" ? null : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin obra asociada" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ninguna">— sin asociar —</SelectItem>
                  {obrasActivas.map(o => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.obra_id} — {o.nombre_obra ?? o.cliente?.nombre ?? "Sin nombre"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Ítems a comprar *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-3.5 w-3.5" /> Agregar ítem
              </Button>
            </div>

            <div className="space-y-2">
              {itemsDraft.map((draft, idx) => {
                const subtotal = draft.cantidad_solicitada * draft.precio_unitario;
                return (
                  <div key={idx} className="rounded-md border bg-secondary/20 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Ítem #{idx + 1}</span>
                      {itemsDraft.length > 1 && (
                        <Button
                          type="button" variant="ghost" size="icon"
                          onClick={() => removeItem(idx)}
                          className="h-7 w-7 text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>

                    <Select
                      value={draft.item_id}
                      onValueChange={(v) => onItemSeleccion(idx, v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar ítem del inventario..." />
                      </SelectTrigger>
                      <SelectContent>
                        {items.map(it => (
                          <SelectItem key={it.id} value={it.id}>
                            {it.descripcion} ({it.item_id})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-[10px]">Cantidad</Label>
                        <Input
                          type="number"
                          min="0.01" step="0.01"
                          value={draft.cantidad_solicitada}
                          onChange={(e) => updateItem(idx, { cantidad_solicitada: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">Precio unitario</Label>
                        <Input
                          type="number"
                          min="0" step="0.01"
                          value={draft.precio_unitario}
                          onChange={(e) => updateItem(idx, { precio_unitario: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">Subtotal</Label>
                        <div className="h-10 flex items-center px-3 text-sm font-medium border rounded-md bg-background">
                          {formatCurrency(subtotal)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2">
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Total estimado</div>
                <div className="text-2xl font-bold">{formatCurrency(totalCalc)}</div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observaciones</Label>
            <Textarea
              rows={2}
              placeholder="Detalles, condiciones especiales..."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={crear.isPending}>
              {crear.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Crear OC
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
