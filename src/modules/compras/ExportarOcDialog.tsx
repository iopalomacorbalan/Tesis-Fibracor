import { useState, useEffect } from "react";
import { Loader2, FileDown, Eye, RefreshCw } from "lucide-react";
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    // Limpiar preview al cerrar
    if (!open && previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }, [open]);

  // Cuando cambian las opciones, invalidamos el preview anterior
  useEffect(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }, [incluirPrecios, observacionesExtra]);

  if (!compra) return null;

  const generarPreview = async () => {
    setGenerando(true);
    try {
      const doc = await generarPdfOc({
        compra,
        options: {
          incluirPrecios,
          observacionesAdicionales: observacionesExtra || undefined,
        },
      });
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      // Limpiar el viejo si existía
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(url);
    } catch (e: any) {
      toast.error("Error generando preview: " + e.message);
    } finally {
      setGenerando(false);
    }
  };

  const handleDescargar = async () => {
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
      toast.success("PDF descargado");
    } catch (e: any) {
      console.error(e);
      toast.error("Error: " + e.message);
    } finally {
      setGenerando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
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

        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
          {/* OPCIONES */}
          <div className="space-y-3">
            <div className="text-sm font-semibold">Opciones</div>

            <label className="flex items-start gap-3 cursor-pointer p-2 rounded-md hover:bg-accent/50 transition-colors border">
              <input
                type="checkbox"
                checked={incluirPrecios}
                onChange={(e) => setIncluirPrecios(e.target.checked)}
                className="mt-1 h-4 w-4 cursor-pointer accent-primary"
              />
              <div>
                <div className="text-sm font-medium">Incluir precios y total</div>
                <div className="text-xs text-muted-foreground">
                  Si lo desactivás, el PDF sale solo con cantidades
                </div>
              </div>
            </label>

            <div className="space-y-2">
              <Label htmlFor="obs" className="text-xs">Observaciones extra (opcional)</Label>
              <Textarea
                id="obs"
                rows={3}
                placeholder="Solo aparecen en este PDF, no se guardan."
                value={observacionesExtra}
                onChange={(e) => setObservacionesExtra(e.target.value)}
                className="text-sm"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={generarPreview}
              disabled={generando}
              className="w-full"
            >
              {generando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : previewUrl ? (
                <RefreshCw className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              {previewUrl ? "Actualizar preview" : "Generar preview"}
            </Button>

            <Button
              onClick={handleDescargar}
              disabled={generando}
              className="w-full"
            >
              {generando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              Descargar PDF
            </Button>
          </div>

          {/* PREVIEW */}
          <div className="border rounded-md bg-secondary/30 min-h-[400px] lg:min-h-[600px] flex items-center justify-center overflow-hidden">
            {previewUrl ? (
              <iframe
                src={previewUrl}
                title="Vista previa"
                className="w-full h-[60vh] lg:h-[75vh] border-0"
              />
            ) : generando ? (
              <div className="text-center text-muted-foreground p-6">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p className="text-sm">Generando PDF...</p>
              </div>
            ) : (
              <div className="text-center text-muted-foreground p-6 max-w-xs">
                <Eye className="h-12 w-12 mx-auto opacity-30 mb-2" />
                <p className="text-sm font-medium mb-1">Vista previa del PDF</p>
                <p className="text-xs">
                  Hacé click en "Generar preview" para ver cómo va a quedar antes de descargar
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 mt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={generando}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
