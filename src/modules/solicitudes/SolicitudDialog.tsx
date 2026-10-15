import { useState, useEffect } from "react";
import { Loader2, Plus, X, Trash2 } from "lucide-react";
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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useCrearSolicitud } from "./useSolicitudes";
import { useObras } from "@/modules/obras/useObras";
import { useInventario } from "@/modules/stock/useInventario";
import { useUsuarios } from "@/modules/obras/useUsuarios";
import type { PrioridadSol } from "@/types/database";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  obraIdFijo?: string | null;
}

type ItemDraft = {
  item_id: string | null;
  descripcion_libre: string;
  cantidad: number;
  unidad: string;
};

export function SolicitudDialog({ open, onOpenChange, obraIdFijo }: Props) {
  const { data: obras = [] } = useObras();
  const { data: items = [] } = useInventario();
  const { data: paniol = [] } = useUsuarios(["Direccion", "Operaciones", "Contabilidad", "Paniol"]);
  const crear = useCrearSolicitud();

  const [obraId, setObraId] = useState<string | null>(obraIdFijo ?? null);
  const [destinatarioId, setDestinatarioId] = useState<string | null>(null);
  const [prioridad, setPrioridad] = useState<PrioridadSol>("Normal");
  const [observaciones, setObservaciones] = useState("");
  const [itemsDraft, setItemsDraft] = useState<ItemDraft[]>([
    { item_id: null, descripcion_libre: "", cantidad: 1, unidad: "ud." },
  ]);

  useEffect(() => {
    if (open) {
      setObraId(obraIdFijo ?? null);
      setDestinatarioId(null);
      setPrioridad("Normal");
      setObservaciones("");
      setItemsDraft([{ item_id: null, descripcion_libre: "", cantidad: 1, unidad: "ud." }]);
    }
  }, [open, obraIdFijo]);

  const obrasActivas = obras.filter(o => ["Pendiente OIO", "En ejecucion"].includes(o.estado));

  const addItem = () => {
    setItemsDraft([...itemsDraft, { item_id: null, descripcion_libre: "", cantidad: 1, unidad: "ud." }]);
  };

  const removeItem = (idx: number) => {
    if (itemsDraft.length === 1) return;
    setItemsDraft(itemsDraft.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, patch: Partial<ItemDraft>) => {
    setItemsDraft(itemsDraft.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };

  const onItemSeleccion = (idx: number, value: string) => {
    if (value === "manual") {
      updateItem(idx, { item_id: null });
    } else {
      const inv = items.find(i => i.id === value);
      updateItem(idx, {
        item_id: value,
        descripcion_libre: "",
        unidad: inv?.unidad ?? "ud.",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!obraId) {
      toast.error("Seleccioná una obra");
      return;
    }
    const itemsValid = itemsDraft.filter(it =>
      (it.item_id || it.descripcion_libre.trim()) && it.cantidad > 0
    );
    if (itemsValid.length === 0) {
      toast.error("Agregá al menos un ítem válido");
      return;
    }
    try {
      const sol = await crear.mutateAsync({
        obra_id: obraId,
        destinatario_id: destinatarioId,
        prioridad,
        observaciones: observaciones || null,
        items: itemsValid.map(it => ({
          item_id: it.item_id,
          descripcion_libre: it.item_id ? null : it.descripcion_libre,
          cantidad: it.cantidad,
          unidad: it.unidad,
        })),
      });
      toast.success(`Solicitud ${sol.solicitud_id} creada`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Nueva solicitud de ítems</DialogTitle>
          <DialogDescription>Pedí materiales o herramientas para una obra</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Obra *</Label>
              <Select value={obraId ?? ""} onValueChange={(v) => setObraId(v || null)} disabled={!!obraIdFijo}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar obra..." />
                </SelectTrigger>
                <SelectContent>
                  {obrasActivas.map(o => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.obra_id} — {o.nombre_obra ?? o.cliente?.nombre ?? "Sin nombre"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Select value={prioridad} onValueChange={(v: any) => setPrioridad(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="Alta">Alta</SelectItem>
                  <SelectItem value="Urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Destinatario (opcional)</Label>
            <Select value={destinatarioId ?? "todos"} onValueChange={(v) => setDestinatarioId(v === "todos" ? null : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Cualquier responsable" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Cualquier responsable</SelectItem>
                {paniol.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.nombre} ({u.area})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Items */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Ítems solicitados *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-3.5 w-3.5" /> Agregar ítem
              </Button>
            </div>

            <div className="space-y-2">
              {itemsDraft.map((draft, idx) => (
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

                  <SearchableSelect
                    value={draft.item_id ?? "manual"}
                    onChange={(v) => onItemSeleccion(idx, v ?? "manual")}
                    placeholder="Seleccionar del inventario..."
                    options={[
                      { value: "manual", label: "📝 Escribir descripción manual" },
                      ...items.map(it => ({
                        value: it.id,
                        label: it.descripcion,
                        searchText: `${it.item_id}${it.numero_serie ? ` · S/N ${it.numero_serie}` : ""}`,
                        hint: `${it.stock_disponible} disp.`,
                      })),
                    ]}
                  />

                  {draft.item_id === null && (
                    <Input
                      placeholder="Descripción del ítem..."
                      value={draft.descripcion_libre}
                      onChange={(e) => updateItem(idx, { descripcion_libre: e.target.value })}
                    />
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      min="0.01" step="0.01"
                      placeholder="Cantidad"
                      value={draft.cantidad || ""}
                      onChange={(e) => updateItem(idx, { cantidad: parseFloat(e.target.value) || 0 })}
                    />
                    <Input
                      placeholder="Unidad (ud., m, kg...)"
                      value={draft.unidad}
                      onChange={(e) => updateItem(idx, { unidad: e.target.value })}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observaciones</Label>
            <Textarea
              rows={2}
              placeholder="Detalles adicionales..."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={crear.isPending}>
              {crear.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Crear solicitud
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
