import { useState } from "react";
import { Loader2, FileDown, PenLine, FileCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { generarPdfRemito } from "@/lib/pdf/remitoPdf";
import { cn } from "@/lib/utils";
import type { RemitoConRelaciones } from "@/types/database";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  remito: RemitoConRelaciones | null;
}

export function RemitoExportarDialog({ open, onOpenChange, remito }: Props) {
  const [version, setVersion] = useState<"final" | "firmar">("firmar");
  const [generando, setGenerando] = useState(false);

  if (!remito) return null;

  const tieneDatosReceptor = !!remito.recibido_por;

  const handleExportar = async () => {
    setGenerando(true);
    try {
      const doc = await generarPdfRemito({
        remito,
        options: { paraFirmar: version === "firmar" },
      });
      const sufijo = version === "firmar" ? "para-firmar" : "final";
      const filename = `${remito.remito_id}-${sufijo}.pdf`;
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
            Exportar remito
          </DialogTitle>
          <DialogDescription>
            <b>{remito.remito_id}</b>
            {remito.cliente?.nombre && <> · {remito.cliente.nombre}</>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="text-sm font-medium mb-2">Versión a generar:</div>

          <button
            type="button"
            onClick={() => setVersion("firmar")}
            className={cn(
              "w-full flex items-start gap-3 p-3 rounded-md border transition-colors text-left",
              version === "firmar"
                ? "bg-warning/10 border-warning/40"
                : "border-border hover:bg-accent/50"
            )}
          >
            <PenLine className={cn("h-5 w-5 flex-shrink-0 mt-0.5",
              version === "firmar" ? "text-warning" : "text-muted-foreground"
            )} />
            <div>
              <div className="text-sm font-medium">Para firmar</div>
              <div className="text-xs text-muted-foreground">
                PDF con campos en blanco para que el cliente firme y complete sus datos.
                Aparece la marca "VERSIÓN PARA FIRMAR" al pie.
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setVersion("final")}
            disabled={!tieneDatosReceptor}
            className={cn(
              "w-full flex items-start gap-3 p-3 rounded-md border transition-colors text-left",
              version === "final"
                ? "bg-success/10 border-success/40"
                : "border-border hover:bg-accent/50",
              !tieneDatosReceptor && "opacity-50 cursor-not-allowed"
            )}
          >
            <FileCheck className={cn("h-5 w-5 flex-shrink-0 mt-0.5",
              version === "final" ? "text-success" : "text-muted-foreground"
            )} />
            <div>
              <div className="text-sm font-medium">Versión final</div>
              <div className="text-xs text-muted-foreground">
                {tieneDatosReceptor
                  ? "PDF con los datos del receptor ya cargados (nombre, DNI, fecha)."
                  : "⚠ Necesitás cargar los datos de recepción (nombre, DNI, fecha) en el remito primero. Editá el remito para agregarlos."}
              </div>
            </div>
          </button>
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
