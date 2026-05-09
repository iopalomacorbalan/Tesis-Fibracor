import { useState } from "react";
import { Loader2, Plus, Trash2, AlertCircle, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  useCostosExtras, useAgregarCostoExtra, useEliminarCostoExtra,
} from "./useCostosExtras";
import { formatCurrency } from "@/lib/utils";
import type { ObraConRelaciones } from "@/types/database";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  obra: ObraConRelaciones | null;
  onContinuar: () => void; // siguiente paso (cerrar obra real)
  modoSimple?: boolean; // si true, solo es para gestionar (sin botón "Continuar")
}

export function CostosExtrasDialog({ open, onOpenChange, obra, onContinuar, modoSimple = false }: Props) {
  const { data: costos = [], isLoading } = useCostosExtras(obra?.id ?? null);
  const agregar = useAgregarCostoExtra();
  const eliminar = useEliminarCostoExtra();

  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState<number>(0);
  const [observaciones, setObservaciones] = useState("");

  const total = costos.reduce((s, c) => s + Number(c.monto), 0);

  if (!obra) return null;

  const handleAgregar = async () => {
    if (!concepto.trim()) {
      toast.error("Ingresá un concepto");
      return;
    }
    if (monto <= 0) {
      toast.error("El monto debe ser mayor a 0");
      return;
    }
    try {
      await agregar.mutateAsync({
        obra_id: obra.id,
        concepto: concepto.trim(),
        monto,
        observaciones: observaciones.trim() || null,
      });
      setConcepto("");
      setMonto(0);
      setObservaciones("");
      toast.success("Costo extra agregado");
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  const handleEliminar = async (id: string) => {
    if (!confirm("¿Eliminar este costo extra?")) return;
    try {
      await eliminar.mutateAsync(id);
      toast.success("Eliminado");
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            {modoSimple ? "Costos extras" : "Costos extras antes de cerrar"}
          </DialogTitle>
          <DialogDescription>
            <b>{obra.obra_id}</b>
            {obra.cliente?.nombre && <> · {obra.cliente.nombre}</>}
            <br />
            {modoSimple
              ? "Gestioná los costos extras de esta obra (técnicos tercerizados, materiales adicionales, etc.)"
              : "Agregá ahora cualquier gasto adicional de esta obra antes de cerrarla. Quedan registrados como parte del costo total."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Form para agregar */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="text-sm font-semibold mb-1">Agregar nuevo costo</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <Label className="text-xs">Concepto *</Label>
                  <Input
                    placeholder="Ej: Técnico tercerizado Juan Pérez"
                    value={concepto}
                    onChange={(e) => setConcepto(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Monto $ *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={monto || ""}
                    onChange={(e) => setMonto(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Observaciones</Label>
                <Textarea
                  rows={2}
                  placeholder="Detalles..."
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                />
              </div>
              <Button
                type="button"
                onClick={handleAgregar}
                disabled={agregar.isPending || !concepto.trim() || monto <= 0}
                className="w-full"
                size="sm"
              >
                {agregar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <Plus className="h-3.5 w-3.5" />
                Agregar
              </Button>
            </CardContent>
          </Card>

          {/* Lista */}
          {isLoading ? (
            <div className="text-center py-4"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
          ) : costos.length === 0 ? (
            <div className="rounded-md bg-secondary/50 p-4 text-sm text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span>No hay costos extras cargados</span>
            </div>
          ) : (
            <Card>
              <CardContent className="p-3">
                <div className="text-sm font-semibold mb-2">
                  Costos extras cargados ({costos.length})
                </div>
                <div className="space-y-1.5">
                  {costos.map(c => (
                    <div key={c.id} className="flex items-center justify-between gap-2 p-2 rounded border border-border bg-secondary/20">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{c.concepto}</div>
                        {c.observaciones && (
                          <div className="text-xs text-muted-foreground truncate">{c.observaciones}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-bold">{formatCurrency(Number(c.monto))}</span>
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => handleEliminar(c.id)}
                          disabled={eliminar.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border mt-3 pt-2 flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total extras:</span>
                  <span className="text-lg font-bold text-primary">{formatCurrency(total)}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {modoSimple ? "Cerrar" : "Cancelar"}
          </Button>
          {!modoSimple && (
            <Button onClick={onContinuar} variant="default">
              {costos.length === 0 ? "Continuar sin costos extras" : "Continuar al cierre"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
