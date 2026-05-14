import { useState } from "react";
import { Loader2, FileDown, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { generarPdfObra } from "@/lib/pdf/obraPdf";
import { useAuth } from "@/lib/auth";
import { puedeVerPrecios } from "@/lib/permissions";
import type { ObraConRelaciones, ReporteConRelaciones } from "@/types/database";
import type { ObraCostos } from "./useObraCostos";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  obra: ObraConRelaciones | null;
  reportes: ReporteConRelaciones[];
  costos: ObraCostos | null;
}

export function ExportarObraDialog({ open, onOpenChange, obra, reportes, costos }: Props) {
  const { profile } = useAuth();
  const puedeFinanciero = puedeVerPrecios(profile?.area);

  const [incluirReportes, setIncluirReportes] = useState(true);
  const [incluirFotos, setIncluirFotos] = useState(true);
  const [incluirFinanciero, setIncluirFinanciero] = useState(false);
  const [incluirMaterialesDetalle, setIncluirMaterialesDetalle] = useState(false);
  const [incluirHerramientas, setIncluirHerramientas] = useState(false);
  const [incluirCostosExtras, setIncluirCostosExtras] = useState(false);
  const [generando, setGenerando] = useState(false);

  if (!obra) return null;

  const handleExportar = async () => {
    setGenerando(true);
    try {
      // Re-fetch reportes con fotos URL completas (por si las imágenes están firmadas y expiraron)
      const { data: repsConFotos } = await supabase
        .from("reportes")
        .select(`
          *,
          tecnico:usuarios!reportes_tecnico_id_fkey(nombre, email),
          fotos:reporte_fotos(*)
        `)
        .eq("obra_id", obra.id)
        .order("fecha", { ascending: true });

      const reportesParaPdf = (repsConFotos as any[] ?? []) as ReporteConRelaciones[];

      const doc = await generarPdfObra({
        obra,
        reportes: incluirReportes ? reportesParaPdf : [],
        costos: (incluirFinanciero || incluirHerramientas) ? costos : null,
        options: {
          incluirReportes,
          incluirFotos,
          incluirFinanciero,
          incluirMaterialesDetalle,
          incluirHerramientas,
          incluirCostosExtras,
        },
      });

      const filename = `${obra.obra_id}-resumen-${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(filename);
      toast.success("PDF generado correctamente");
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error("Error generando PDF: " + e.message);
    } finally {
      setGenerando(false);
    }
  };

  const numFotos = reportes.reduce((s, r) => s + (r.fotos?.length ?? 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5 text-primary" />
            Exportar resumen de obra
          </DialogTitle>
          <DialogDescription>
            <b>{obra.obra_id}</b>
            {obra.cliente?.nombre && <> · {obra.cliente.nombre}</>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="text-sm font-medium break-words">Contenido del PDF:</div>

          <CheckOption
            checked={incluirReportes}
            onChange={setIncluirReportes}
            label="Reportes de obra"
            description={`${reportes.length} reportes ${incluirReportes && incluirFotos ? `con fotos` : "sin fotos"}`}
          />

          {incluirReportes && (
            <div className="ml-6">
              <CheckOption
                checked={incluirFotos}
                onChange={setIncluirFotos}
                label="Incluir fotos"
                description={`${numFotos} foto${numFotos !== 1 ? "s" : ""} en total`}
                disabled={!incluirReportes}
              />
            </div>
          )}

          {puedeFinanciero && (
            <CheckOption
              checked={incluirFinanciero}
              onChange={setIncluirFinanciero}
              label="Resumen financiero"
              description="Presupuesto vs ejecutado, margen, OCs, costos extras"
              warning={incluirFinanciero ? "⚠ El PDF incluirá información de costos sensible" : undefined}
            />
          )}

          {incluirFinanciero && (
            <div className="ml-6 space-y-2">
              <CheckOption
                checked={incluirMaterialesDetalle}
                onChange={setIncluirMaterialesDetalle}
                label="Detalle de materiales"
                description="Tabla con cada ítem y su costo"
              />
              <CheckOption
                checked={incluirCostosExtras}
                onChange={setIncluirCostosExtras}
                label="Costos extras"
                description="Tercerizados, materiales adicionales, etc."
              />
            </div>
          )}

          <CheckOption
            checked={incluirHerramientas}
            onChange={setIncluirHerramientas}
            label="Herramientas utilizadas"
            description="Lista de herramientas asignadas a técnicos con su estado final (devuelta/no devuelta/dañada)"
          />
        </div>

        {numFotos > 30 && incluirFotos && (
          <div className="rounded-md bg-warning/10 border border-warning/30 p-3 text-xs flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <b>Hay muchas fotos ({numFotos}).</b> El PDF puede tardar bastante en generarse y pesar varios MB.
            </div>
          </div>
        )}

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

function CheckOption({
  checked, onChange, label, description, disabled, warning,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  warning?: string;
}) {
  return (
    <label className={`flex items-start gap-3 cursor-pointer p-2 rounded-md hover:bg-accent/50 transition-colors ${disabled ? "opacity-60 pointer-events-none" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-1 h-4 w-4 cursor-pointer accent-primary"
      />
      <div className="flex-1">
        <div className="text-sm font-medium break-words">{label}</div>
        {description && <div className="text-xs text-muted-foreground">{description}</div>}
        {warning && <div className="text-xs text-warning mt-0.5">{warning}</div>}
      </div>
    </label>
  );
}
