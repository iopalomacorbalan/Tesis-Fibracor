import { useState, useEffect } from "react";
import { Loader2, ArrowDown, ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useAjustarStock } from "./useInventario";
import { ajusteSchema, type AjusteFormValues } from "./schemas";
import type { Inventario } from "@/types/database";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Inventario | null;
}

export function AjusteDialog({ open, onOpenChange, item }: Props) {
  const ajustar = useAjustarStock();

  const [form, setForm] = useState<AjusteFormValues>({
    cantidad: 1,
    tipo: "Ajuste_positivo",
    motivo: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setForm({ cantidad: 1, tipo: "Ajuste_positivo", motivo: "" });
      setErrors({});
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;

    const parsed = ajusteSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach(i => { errs[i.path.join(".")] = i.message; });
      setErrors(errs);
      return;
    }

    try {
      await ajustar.mutateAsync({
        item_id: item.id,
        cantidad: parsed.data.cantidad,
        motivo: parsed.data.motivo,
        tipo: parsed.data.tipo,
      });
      toast.success(
        `Stock ${parsed.data.tipo === "Ajuste_positivo" ? "aumentado" : "reducido"} en ${parsed.data.cantidad} ${item.unidad}`
      );
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  if (!item) return null;

  const stockNuevoEst = form.tipo === "Ajuste_positivo"
    ? item.stock_disponible + (form.cantidad || 0)
    : item.stock_disponible - (form.cantidad || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar stock</DialogTitle>
          <DialogDescription>
            <span className="font-medium">{item.descripcion}</span>
            <br />
            <span className="text-xs">{item.item_id} · {item.unidad}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md bg-secondary/50 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Stock actual:</span>
            <span className="font-bold">{item.stock_disponible} {item.unidad}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de ajuste *</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, tipo: "Ajuste_positivo" }))}
                className={`flex items-center gap-2 px-4 py-3 rounded-md border transition-colors ${
                  form.tipo === "Ajuste_positivo"
                    ? "bg-success/15 border-success text-success"
                    : "bg-background hover:bg-accent"
                }`}
              >
                <ArrowUp className="h-4 w-4" />
                Aumentar
              </button>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, tipo: "Ajuste_negativo" }))}
                className={`flex items-center gap-2 px-4 py-3 rounded-md border transition-colors ${
                  form.tipo === "Ajuste_negativo"
                    ? "bg-destructive/15 border-destructive text-destructive"
                    : "bg-background hover:bg-accent"
                }`}
              >
                <ArrowDown className="h-4 w-4" />
                Reducir
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cantidad">Cantidad ({item.unidad}) *</Label>
            <Input
              id="cantidad"
              type="number"
              min="0.01"
              step="0.01"
              value={form.cantidad}
              onChange={(e) => setForm(f => ({ ...f, cantidad: parseFloat(e.target.value) || 0 }))}
              autoFocus
            />
            {errors["cantidad"] && <p className="text-sm text-destructive">{errors["cantidad"]}</p>}
          </div>

          <div className="rounded-md bg-secondary/30 p-3 text-sm flex justify-between">
            <span className="text-muted-foreground">Stock final estimado:</span>
            <span className={`font-bold ${stockNuevoEst < 0 ? "text-destructive" : ""}`}>
              {stockNuevoEst} {item.unidad}
            </span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo *</Label>
            <Textarea
              id="motivo"
              rows={2}
              placeholder="Ej: Conteo físico, ajuste de inventario, error de carga..."
              value={form.motivo}
              onChange={(e) => setForm(f => ({ ...f, motivo: e.target.value }))}
              className={errors["motivo"] ? "border-destructive" : ""}
            />
            {errors["motivo"] && <p className="text-sm text-destructive">{errors["motivo"]}</p>}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={ajustar.isPending}>
              {ajustar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Aplicar ajuste
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
