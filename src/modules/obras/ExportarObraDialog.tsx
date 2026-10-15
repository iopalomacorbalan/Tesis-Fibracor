import { useState, useEffect } from "react";
import {
  Loader2, FileDown, AlertCircle, Users, Building2, FileText, Image, Wallet, Wrench, Clock,
  ClipboardList, ShieldAlert, ChevronDown, Check,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn, formatDate } from "@/lib/utils";
import { generarPdfObra } from "@/lib/pdf/obraPdf";
import { useAuth } from "@/lib/auth";
import { puedeVerPrecios } from "@/lib/permissions";
import { useHorasPorDiaObra, useTotalHorasObra } from "./useHorasTecnicas";
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
  const verCostoHoras = !!profile && ["Direccion", "Operaciones", "Contabilidad"].includes(profile.area);

  const { data: horasPorDia = [] } = useHorasPorDiaObra(obra?.id ?? null);
  const { data: totalHoras } = useTotalHorasObra(obra?.id ?? null);

  const [incluirReportes, setIncluirReportes] = useState(true);
  const [incluirRecomendaciones, setIncluirRecomendaciones] = useState(false);
  const [incluirFotos, setIncluirFotos] = useState(true);
  const [incluirFinanciero, setIncluirFinanciero] = useState(false);
  const [incluirMaterialesDetalle, setIncluirMaterialesDetalle] = useState(false);
  const [incluirHerramientas, setIncluirHerramientas] = useState(false);
  const [incluirCostosExtras, setIncluirCostosExtras] = useState(false);
  const [incluirHorasTecnicas, setIncluirHorasTecnicas] = useState(false);
  const [incluirCostoHoras, setIncluirCostoHoras] = useState(false);
  const [incluirDesgloseHoras, setIncluirDesgloseHoras] = useState(true);
  const [reportesSeleccionados, setReportesSeleccionados] = useState<Set<string>>(
    () => new Set(reportes.map(r => r.id))
  );
  const [generando, setGenerando] = useState(false);
  const [verListaReportes, setVerListaReportes] = useState(false);

  // Sincronizar reportes seleccionados cuando cambia la lista (al abrir/cambiar obra)
  useEffect(() => {
    setReportesSeleccionados(new Set(reportes.map(r => r.id)));
  }, [reportes]);

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

      const reportesParaPdf = (repsConFotos as any[] ?? [])
        .filter((r: any) => reportesSeleccionados.has(r.id)) as ReporteConRelaciones[];

      const doc = await generarPdfObra({
        obra,
        reportes: incluirReportes ? reportesParaPdf : [],
        costos: (incluirFinanciero || incluirHerramientas) ? costos : null,
        horasTecnicas: incluirHorasTecnicas ? {
          porDia: horasPorDia,
          total: totalHoras ?? null,
          incluirCosto: incluirCostoHoras && verCostoHoras,
          incluirDesglose: incluirDesgloseHoras,
        } : null,
        options: {
          incluirReportes,
          incluirFotos,
          incluirFinanciero,
          incluirMaterialesDetalle,
          incluirHerramientas,
          incluirCostosExtras,
          incluirHorasTecnicas,
          incluirRecomendaciones,
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
  const fotosSeleccionadas = reportes
    .filter(r => reportesSeleccionados.has(r.id))
    .reduce((s, r) => s + (r.fotos?.length ?? 0), 0);
  const hayRecomendaciones = !!obra.cliente?.recomendaciones;
  const hayHoras = horasPorDia.length > 0;

  // ====== Atajos ======
  const aplicarCliente = () => {
    setIncluirRecomendaciones(false);
    setIncluirReportes(true);
    setIncluirFotos(true);
    setReportesSeleccionados(new Set(reportes.map(r => r.id)));
    setIncluirFinanciero(false);
    setIncluirMaterialesDetalle(false);
    setIncluirCostosExtras(false);
    setIncluirHerramientas(false);
    setIncluirHorasTecnicas(hayHoras);
    setIncluirDesgloseHoras(true);
    setIncluirCostoHoras(false);
  };
  const aplicarInterno = () => {
    setIncluirRecomendaciones(hayRecomendaciones);
    setIncluirReportes(true);
    setIncluirFotos(true);
    setReportesSeleccionados(new Set(reportes.map(r => r.id)));
    setIncluirFinanciero(puedeFinanciero);
    setIncluirMaterialesDetalle(puedeFinanciero);
    setIncluirCostosExtras(puedeFinanciero);
    setIncluirHerramientas(true);
    setIncluirHorasTecnicas(hayHoras);
    setIncluirDesgloseHoras(true);
    setIncluirCostoHoras(verCostoHoras);
  };

  const sensible = incluirFinanciero || (incluirHorasTecnicas && incluirCostoHoras && verCostoHoras);
  const esCliente = !sensible && !incluirHerramientas && !incluirRecomendaciones && incluirReportes;
  const esInterno = incluirReportes && incluirHerramientas
    && (!puedeFinanciero || (incluirFinanciero && incluirMaterialesDetalle && incluirCostosExtras))
    && (!hayHoras || incluirHorasTecnicas);

  const secciones = [
    incluirRecomendaciones && hayRecomendaciones && "Recomendaciones",
    incluirReportes && reportesSeleccionados.size > 0 && `Reportes (${reportesSeleccionados.size})`,
    incluirReportes && incluirFotos && fotosSeleccionadas > 0 && `${fotosSeleccionadas} fotos`,
    incluirFinanciero && puedeFinanciero && "Finanzas",
    incluirHerramientas && "Herramientas",
    incluirHorasTecnicas && hayHoras && "Horas técnicas",
  ].filter(Boolean) as string[];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[calc(100vw-1rem)] sm:w-full max-h-[92vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5 text-primary" />
            Exportar resumen de obra
          </DialogTitle>
          <DialogDescription>
            <b>{obra.obra_id}</b>
            {obra.nombre_obra && <> · {obra.nombre_obra}</>}
            {obra.cliente?.nombre && <> · {obra.cliente.nombre}</>}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Atajos */}
          <section className="space-y-2">
            <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">¿Para quién es?</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <AtajoCard
                icon={Users}
                titulo="Para el cliente"
                descripcion="Reportes, fotos y horas. Sin costos ni datos internos."
                activo={esCliente}
                onClick={aplicarCliente}
              />
              <AtajoCard
                icon={Building2}
                titulo="Informe interno"
                descripcion={puedeFinanciero
                  ? "Todo: reportes, finanzas, materiales, herramientas y horas."
                  : "Todo lo disponible: reportes, herramientas y horas."}
                activo={esInterno}
                onClick={aplicarInterno}
              />
            </div>
          </section>

          {/* Secciones */}
          <section className="space-y-2">
            <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Secciones del PDF</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Reportes (ancho completo: tiene la lista) */}
              <SeccionCard
                className="sm:col-span-2"
                icon={FileText}
                titulo="Reportes de obra"
                detalle={reportes.length === 0
                  ? "Esta obra no tiene reportes"
                  : `${reportesSeleccionados.size} de ${reportes.length} reportes · ${numFotos} foto${numFotos === 1 ? "" : "s"}`}
                checked={incluirReportes && reportes.length > 0}
                disabled={reportes.length === 0}
                onChange={setIncluirReportes}
              >
                {reportes.length > 0 && (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <OpcionChip
                        checked={incluirFotos}
                        onChange={setIncluirFotos}
                        label={`Incluir fotos (${fotosSeleccionadas})`}
                        disabled={numFotos === 0}
                      />
                      <button
                        type="button"
                        onClick={() => setVerListaReportes(v => !v)}
                        className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-input hover:bg-accent transition-colors"
                      >
                        Elegir reportes ({reportesSeleccionados.size}/{reportes.length})
                        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", verListaReportes && "rotate-180")} />
                      </button>
                    </div>

                    {verListaReportes && (
                      <div className="rounded-lg border bg-background/50 divide-y">
                        <div className="flex items-center justify-between gap-2 px-3 py-2">
                          <span className="text-xs text-muted-foreground">Tildá los que querés incluir</span>
                          <div className="flex gap-1">
                            <button type="button"
                              onClick={() => setReportesSeleccionados(new Set(reportes.map(r => r.id)))}
                              className="text-xs px-2 py-0.5 rounded hover:bg-accent text-primary">
                              Todos
                            </button>
                            <button type="button"
                              onClick={() => setReportesSeleccionados(new Set())}
                              className="text-xs px-2 py-0.5 rounded hover:bg-accent text-muted-foreground">
                              Ninguno
                            </button>
                          </div>
                        </div>
                        <div className="max-h-56 overflow-y-auto">
                          {reportes.map(r => {
                            const checked = reportesSeleccionados.has(r.id);
                            return (
                              <label key={r.id}
                                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-accent/30">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => setReportesSeleccionados(prev => {
                                    const next = new Set(prev);
                                    if (e.target.checked) next.add(r.id); else next.delete(r.id);
                                    return next;
                                  })}
                                  className="h-4 w-4 accent-primary"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium">
                                    {r.reporte_id} <span className="text-muted-foreground font-normal">· {formatDate(r.fecha)}</span>
                                  </div>
                                  {r.tecnico?.nombre && (
                                    <div className="text-xs text-muted-foreground truncate">{r.tecnico.nombre}</div>
                                  )}
                                </div>
                                {(r.fotos?.length ?? 0) > 0 && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                                    <Image className="h-3.5 w-3.5" /> {r.fotos!.length}
                                  </span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </SeccionCard>

              {puedeFinanciero && (
                <SeccionCard
                  icon={Wallet}
                  titulo="Resumen financiero"
                  detalle="Presupuesto vs ejecutado, margen y órdenes de compra"
                  checked={incluirFinanciero}
                  onChange={setIncluirFinanciero}
                  sensible
                >
                  <div className="flex flex-wrap gap-2">
                    <OpcionChip checked={incluirMaterialesDetalle} onChange={setIncluirMaterialesDetalle} label="Detalle de materiales" />
                    <OpcionChip checked={incluirCostosExtras} onChange={setIncluirCostosExtras} label="Costos extras" />
                  </div>
                </SeccionCard>
              )}

              <SeccionCard
                icon={Wrench}
                titulo="Herramientas utilizadas"
                detalle="Asignadas a técnicos y su estado final (devuelta, no devuelta, dañada)"
                checked={incluirHerramientas}
                onChange={setIncluirHerramientas}
              />

              {hayHoras && (
                <SeccionCard
                  icon={Clock}
                  titulo="Horas técnicas"
                  detalle={`${(totalHoras?.total_horas ?? 0).toFixed(2)} hs en ${horasPorDia.length} día${horasPorDia.length === 1 ? "" : "s"}`}
                  checked={incluirHorasTecnicas}
                  onChange={setIncluirHorasTecnicas}
                >
                  <div className="flex flex-wrap gap-2">
                    <OpcionChip checked={incluirDesgloseHoras} onChange={setIncluirDesgloseHoras} label="Desglose por día" />
                    {verCostoHoras && (
                      <OpcionChip checked={incluirCostoHoras} onChange={setIncluirCostoHoras} label="Costo en pesos" sensible />
                    )}
                  </div>
                </SeccionCard>
              )}

              {hayRecomendaciones && (
                <SeccionCard
                  icon={ClipboardList}
                  titulo="Recomendaciones del cliente"
                  detalle="Políticas de acceso y seguridad cargadas en el CRM"
                  checked={incluirRecomendaciones}
                  onChange={setIncluirRecomendaciones}
                />
              )}
            </div>
          </section>

          {numFotos > 30 && incluirReportes && incluirFotos && (
            <div className="rounded-md bg-warning/10 border border-warning/30 p-3 text-xs flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
              <div>
                <b>Hay muchas fotos ({fotosSeleccionadas}).</b> El PDF puede tardar en generarse y pesar varios MB.
              </div>
            </div>
          )}
        </div>

        {/* Pie fijo: resumen + descargar */}
        <div className="border-t p-4 sm:px-6 space-y-3 bg-card">
          <div className="text-sm">
            <span className="text-muted-foreground">El PDF incluye: </span>
            {secciones.length > 0
              ? <span className="font-medium">Datos de la obra · {secciones.join(" · ")}</span>
              : <span className="font-medium">solo los datos de la obra</span>}
          </div>
          {sensible && (
            <div className="flex items-center gap-2 text-xs text-warning">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              Contiene costos internos. No lo compartas con el cliente.
            </div>
          )}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={generando}>
              Cancelar
            </Button>
            <Button onClick={handleExportar} disabled={generando} className="sm:min-w-[180px]">
              {generando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              {generando ? "Generando..." : "Descargar PDF"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ====== Piezas visuales ======

function AtajoCard({ icon: Icon, titulo, descripcion, activo, onClick }: {
  icon: React.ComponentType<{ className?: string }>;
  titulo: string;
  descripcion: string;
  activo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 p-4 rounded-lg border text-left transition-colors",
        activo ? "border-primary bg-primary/10" : "border-border hover:bg-accent",
      )}
    >
      <div className={cn(
        "h-10 w-10 rounded-md flex items-center justify-center shrink-0",
        activo ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
      )}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold flex items-center gap-2">
          {titulo}
          {activo && <Check className="h-4 w-4 text-primary" />}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">{descripcion}</div>
      </div>
    </button>
  );
}

function SeccionCard({
  icon: Icon, titulo, detalle, checked, onChange, disabled, sensible, className, children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  titulo: string;
  detalle: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  sensible?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn(
      "rounded-lg border p-4 space-y-3 transition-colors",
      checked ? "border-primary/50 bg-primary/5" : "border-border",
      disabled && "opacity-60",
      className,
    )}>
      <label className={cn("flex items-start gap-3", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
        <div className={cn(
          "h-9 w-9 rounded-md flex items-center justify-center shrink-0",
          checked ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground",
        )}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold flex items-center gap-2 flex-wrap">
            {titulo}
            {sensible && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/15 text-warning font-medium">Interno</span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{detalle}</div>
        </div>
        <Switch checked={checked} disabled={disabled} onChange={onChange} />
      </label>
      {checked && children && <div className="pl-12 space-y-3">{children}</div>}
    </div>
  );
}

function Switch({ checked, onChange, disabled }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <span className="relative inline-flex shrink-0 mt-1">
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={cn(
        "h-5 w-9 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
        checked ? "bg-primary" : "bg-input",
      )} />
      <span className={cn(
        "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-background shadow transition-transform",
        checked && "translate-x-4",
      )} />
    </span>
  );
}

function OpcionChip({ checked, onChange, label, disabled, sensible }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  sensible?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors disabled:opacity-50",
        checked
          ? sensible ? "bg-warning/15 text-warning border-warning/40" : "bg-primary text-primary-foreground border-primary"
          : "border-input hover:bg-accent text-muted-foreground",
      )}
    >
      {checked && <Check className="h-3 w-3" />}
      {label}
    </button>
  );
}
