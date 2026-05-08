import { useState } from "react";
import { Loader2, FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { generarPdfOc } from "@/lib/pdf/ocPdf";
import type { CompraConRelaciones } from "@/types/database";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  compra: CompraConRelaciones | null;
}

export function ExportarOcDialog({ open, onOpenChange, compra }: Props) {
  const [incluirPrecios, setIncluirPrecios] = useState(true);
  const [observacionesExtra, setObservacionesExtra] = useState("");
  const [generando, setGenerando] = useState(false);

  if (!compra) return null;

  const handleExportar = async () => {
    setGenerando(true);
    try {
      const doc = await generarPdfOc({
        compra,
        options: {
          incluirPrecios,
          observacionesAdicionales: observacionesExtra || undefined,
        },
      });
      const filename = `${compra.compra_id}-${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(filename);
      toast.success("PDF generado");
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error("Error: " + e.message);
    } finally {
      setGenerando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5 text-primary" />
            Exportar orden de compra
          </DialogTitle>
          <DialogDescription>
            <b>{compra.compra_id}</b>
            {compra.proveedor?.nombre && <> · {compra.proveedor.nombre}</>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer p-2 rounded-md hover:bg-accent/50 transition-colors">
            <input
              type="checkbox"
              checked={incluirPrecios}
              onChange={(e) => setIncluirPrecios(e.target.checked)}
              className="mt-1 h-4 w-4 cursor-pointer accent-primary"
            />
            <div>
              <div className="text-sm font-medium">Incluir precios y total</div>
              <div className="text-xs text-muted-foreground">
                Si lo desactivás, se manda solo cantidades (el proveedor cotiza)
              </div>
            </div>
          </label>

          <div className="space-y-2">
            <Label htmlFor="obs">Observaciones adicionales para esta versión (opcional)</Label>
            <Textarea
              id="obs"
              rows={2}
              placeholder="Ej: Por favor enviar a depósito Av. Corrientes 1234..."
              value={observacionesExtra}
              onChange={(e) => setObservacionesExtra(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Estas observaciones aparecen solo en este PDF, no se guardan en la OC.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={generando}>
            Cancelar
          </Button>
          <Button onClick={handleExportar} disabled={generando}>
            {generando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            {generando ? "Generando..." : "Descargar PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
