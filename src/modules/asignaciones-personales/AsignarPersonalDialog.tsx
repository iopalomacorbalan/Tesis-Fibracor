import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useInventario } from "@/modules/stock/useInventario";
import { useAsignarPersonal } from "./useAsignacionesPersonales";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tecnicoId: string;
  tecnicoNombre: string;
}

interface Linea {
  item_id: string;
  cantidad: number;
}

export function AsignarPersonalDialog({ open, onOpenChange, tecnicoId, tecnicoNombre }: Props) {
  const { data: inventario = [] } = useInventario();
  const asignar = useAsignarPersonal();
  const [lineas, setLineas] = useState<Linea[]>([{ item_id: "", cantidad: 1 }]);
  const [observaciones, setObservaciones] = useState("");

  const reset = () => {
    setLineas([{ item_id: "", cantidad: 1 }]);
    setObservaciones("");
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const items = lineas
      .filter(l => l.item_id && l.cantidad > 0)
      .map(l => ({ item_id: l.item_id, cantidad: l.cantidad }));

    if (items.length === 0) {
      toast.error("Agregá al menos un item con cantidad");
      return;
    }

    // Validar stock disponible
    for (const l of items) {
      const inv = inventario.find(i => i.id === l.item_id);
      if (!inv) continue;
      if (inv.stock_disponible < l.cantidad) {
        toast.error(`Stock insuficiente de ${inv.descripcion}: disponible ${inv.stock_disponible}, solicitado ${l.cantidad}`);
        return;
      }
    }

    try {
      await asignar.mutateAsync({
        tecnico_id: tecnicoId,
        items,
        observaciones: observaciones || undefined,
      });
      toast.success(`Items asignados a ${tecnicoNombre}`);
      handleClose(false);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Asignar items a {tecnicoNombre}</DialogTitle>
          <DialogDescription>
            Estos items se descuentan del stock disponible y quedan en poder del técnico hasta que se devuelvan.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Items a asignar</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setLineas([...lineas, { item_id: "", cantidad: 1 }])}
              >
                <Plus className="h-4 w-4 mr-1" />
                Agregar
              </Button>
            </div>

            {lineas.map((linea, idx) => {
              const inv = inventario.find(i => i.id === linea.item_id);
              return (
                <div key={idx} className="border rounded-md p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <SearchableSelect
                        value={linea.item_id || null}
                        onChange={(v) => {
                          const copy = [...lineas];
                          copy[idx] = { ...copy[idx], item_id: v ?? "" };
                          setLineas(copy);
                        }}
                        placeholder="Buscar item..."
                        options={inventario
                          .filter(i => i.activo && i.stock_disponible > 0)
                          .map(i => ({
                            value: i.id,
                            label: i.descripcion,
                            searchText: `${i.item_id}${i.numero_serie ? ` S/N ${i.numero_serie}` : ""}${i.ubicacion_fisica ? ` ubic ${i.ubicacion_fisica}` : ""}`,
                            hint: `${i.stock_disponible} ${i.unidad} disp.${i.ubicacion_fisica ? ` · 📍 ${i.ubicacion_fisica}` : ""}`,
                          }))}
                      />
                    </div>
                    {lineas.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setLineas(lineas.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Label className="text-xs whitespace-nowrap">Cantidad:</Label>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={linea.cantidad || ""}
                      onChange={(e) => {
                        const copy = [...lineas];
                        copy[idx] = { ...copy[idx], cantidad: parseFloat(e.target.value) || 0 };
                        setLineas(copy);
                      }}
                      className="w-24"
                    />
                    {inv && (
                      <span className="text-xs text-muted-foreground">
                        {inv.unidad} (disp: {inv.stock_disponible})
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            <Label>Observaciones (opcional)</Label>
            <Textarea
              rows={2}
              placeholder="Ej: Herramientas básicas, cinturón, etc."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={asignar.isPending}>
              {asignar.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Asignar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
