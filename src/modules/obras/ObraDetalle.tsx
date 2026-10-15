import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Briefcase, MapPin, Calendar, User, Users, Loader2, Clock,
  Wrench, ClipboardList, FileText, GitBranch, Wallet, FileDown, AlertTriangle, MessageCircle,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useObra } from "./useObras";
import { useObraCostos } from "./useObraCostos";
import { useHorasTecnicasObra, useTotalHorasObra, useHorasPorDiaObra, type TotalHorasObra } from "./useHorasTecnicas";
import { ExportarObraDialog } from "./ExportarObraDialog";
import { ObraResumen } from "./ObraResumen";
import { ReporteDetalle } from "@/modules/reportes/ReporteDetalle";
import { useAuth } from "@/lib/auth";
import { puedeVerPrecios } from "@/lib/permissions";
import { supabase } from "@/lib/supabase";
import { formatDate, formatCurrency, cn } from "@/lib/utils";
import type { ObraConRelaciones, EstadoObra } from "@/types/database";
import { Link } from "react-router-dom";

const ESTADO_COLOR: Record<EstadoObra, string> = {
  "Pendiente OIO": "bg-warning/15 text-warning border-warning/30",
  "En ejecucion": "bg-success/15 text-success border-success/30",
  "Para cierre": "bg-primary/15 text-primary border-primary/30",
  "Cerrada": "bg-muted text-muted-foreground border-border",
  "Cancelada": "bg-destructive/15 text-destructive border-destructive/30",
};

// Hook para datos relacionados a la obra
function useObraDatos(obraId: string | null) {
  return useQuery({
    queryKey: ["obra_datos", obraId],
    enabled: !!obraId,
    queryFn: async () => {
      if (!obraId) return null;
      const [solRes, movRes, repRes] = await Promise.all([
        supabase
          .from("solicitudes")
          .select(`*, items:solicitud_items(*, item:inventario(item_id, descripcion, unidad))`)
          .eq("obra_id", obraId)
          .order("fecha_solicitud", { ascending: false }),
        supabase
          .from("movimientos")
          .select(`*, item:inventario(item_id, descripcion, unidad), tecnico:usuarios!movimientos_tecnico_id_fkey(nombre)`)
          .eq("obra_id", obraId)
          .order("fecha", { ascending: false })
          .limit(50),
        supabase
          .from("reportes")
          .select(`*, tecnico:usuarios!reportes_tecnico_id_fkey(nombre), fotos:reporte_fotos(*)`)
          .eq("obra_id", obraId)
          .order("fecha", { ascending: false }),
      ]);
      return {
        solicitudes: (solRes.data ?? []) as any[],
        movimientos: (movRes.data ?? []) as any[],
        reportes: (repRes.data ?? []) as any[],
      };
    },
  });
}

/** Página de detalle de obra: /obras/:id */
export default function ObraDetallePage() {
  const { id } = useParams<{ id: string }>();
  const obraId = id ?? null;
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: obra, isLoading, error } = useObra(obraId ?? undefined);
  const { data: datos } = useObraDatos(obraId);

  // Direccion, Contabilidad y Comercial ven precios. Operaciones, Paniol y Tecnico NO.
  const puedeVerCostos = puedeVerPrecios(profile?.area);
  const verPrecios = puedeVerCostos;

  // Solo cargar costos si el usuario puede verlos (evita errores de RLS para técnicos)
  const { data: costos } = useObraCostos(puedeVerCostos ? obraId : null);
  // Total de horas técnicas para incluir en el centro de costos
  const { data: totalHorasParaCostos } = useTotalHorasObra(puedeVerCostos ? obraId : null);
  const [exportOpen, setExportOpen] = useState(false);
  const [tab, setTab] = useState("resumen");
  const [reporteVer, setReporteVer] = useState<any | null>(null);

  // Cada obra abre en el resumen
  useEffect(() => { setTab("resumen"); }, [obraId]);

  if (!obraId) return null;

  // Volver a donde estaba (lista, calendario...) o a Obras si entró por link directo
  const volver = () => {
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate("/obras");
  };

  return (
    <div className="space-y-4 sm:space-y-5 max-w-6xl mx-auto">
        {/* Barra superior: volver · título · estado · exportar */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={volver} title="Volver">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight flex-1 min-w-0 truncate">
            Detalle de obra
          </h1>
          {obra && (
            <>
              <span className={cn(
                "px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-semibold border whitespace-nowrap",
                ESTADO_COLOR[obra.estado],
              )}>
                {obra.estado}
              </span>
              <Button variant="outline" size="sm" onClick={() => setExportOpen(true)} title="Exportar PDF">
                <FileDown className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Exportar PDF</span>
              </Button>
            </>
          )}
        </div>

        {isLoading ? (
          <div className="py-12 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          </div>
        ) : error || !obra ? (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <p className="text-destructive font-medium">No se pudo cargar la obra</p>
              <p className="text-sm text-muted-foreground">
                {error?.message ?? "Es posible que no exista o que no tengas permisos para verla."}
              </p>
              <Button variant="outline" size="sm" onClick={() => navigate("/obras")}>
                Ir a Obras
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>

            {/* Banner de recomendaciones del cliente */}
            {obra.cliente?.recomendaciones && (
              <RecomendacionesClienteBanner
                texto={obra.cliente.recomendaciones}
                prioridad={obra.cliente.recomendaciones_prioridad ?? "normal"}
                clienteNombre={obra.cliente.nombre}
              />
            )}

            <Tabs value={tab} onValueChange={setTab}>
              <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0 pb-1">
                <TabsList className="w-max">
                  <TabsTrigger value="resumen">📋 <span className="hidden sm:inline ml-1">Resumen</span></TabsTrigger>
                  <TabsTrigger value="solicitudes">
                    <ClipboardList className="h-3.5 w-3.5 sm:mr-1" />
                    <span className="hidden sm:inline">Solicitudes</span>
                    <span className="ml-1">({datos?.solicitudes.length ?? 0})</span>
                  </TabsTrigger>
                  <TabsTrigger value="movimientos">
                    <GitBranch className="h-3.5 w-3.5 sm:mr-1" />
                    <span className="hidden sm:inline">Movimientos</span>
                    <span className="ml-1">({datos?.movimientos.length ?? 0})</span>
                  </TabsTrigger>
                  <TabsTrigger value="reportes">
                    <FileText className="h-3.5 w-3.5 sm:mr-1" />
                    <span className="hidden sm:inline">Reportes</span>
                    <span className="ml-1">({datos?.reportes.length ?? 0})</span>
                  </TabsTrigger>
                  {puedeVerCostos && (
                    <TabsTrigger value="horas">
                      <Clock className="h-3.5 w-3.5 sm:mr-1" />
                      <span className="hidden sm:inline">Horas técnicas</span>
                      <span className="sm:hidden">Horas</span>
                    </TabsTrigger>
                  )}
                  {puedeVerCostos && (
                    <TabsTrigger value="costos">
                      <Wallet className="h-3.5 w-3.5 sm:mr-1" />
                      <span className="hidden sm:inline">Costos</span>
                      <span className="sm:hidden ml-1">$</span>
                    </TabsTrigger>
                  )}
                </TabsList>
              </div>

              <TabsContent value="resumen" className="space-y-4">
                <ObraResumen
                  obra={obra}
                  verPrecios={verPrecios}
                  cantidadReportes={datos?.reportes.length ?? 0}
                  cantidadFotos={(datos?.reportes ?? []).reduce((n: number, r: any) => n + (r.fotos?.length ?? 0), 0)}
                  onVerReportes={() => setTab("reportes")}
                />
              </TabsContent>

              <TabsContent value="solicitudes">
                {(datos?.solicitudes.length ?? 0) === 0 ? (
                  <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Sin solicitudes</CardContent></Card>
                ) : (
                  <div className="space-y-2">
                    {datos!.solicitudes.map((s: any) => (
                      <Card key={s.id}>
                        <CardContent className="p-3">
                          <div className="flex justify-between items-start gap-2 flex-wrap">
                            <div>
                              <span className="font-medium text-sm">{s.solicitud_id}</span>
                              <span className="text-xs text-muted-foreground ml-2">{formatDate(s.fecha_solicitud)}</span>
                            </div>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary">{s.estado}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {s.items?.length ?? 0} ítem(s) · prioridad {s.prioridad}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="movimientos">
                {(datos?.movimientos.length ?? 0) === 0 ? (
                  <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Sin movimientos</CardContent></Card>
                ) : (
                  <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
                    {datos!.movimientos.map((m: any) => (
                      <Card key={m.id}>
                        <CardContent className="p-3">
                          <div className="flex justify-between items-start gap-2 flex-wrap text-sm">
                            <div>
                              <b>{m.tipo}</b> · {m.cantidad} {m.item?.unidad}
                              <span className="text-xs text-muted-foreground ml-2">{m.mov_id}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">{formatDate(m.fecha)}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {m.item?.descripcion}
                            {m.tecnico && <> · 👤 {m.tecnico.nombre}</>}
                          </div>
                          {m.observaciones && (
                            <div className="text-xs text-muted-foreground italic mt-0.5">"{m.observaciones}"</div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="reportes">
                {(datos?.reportes.length ?? 0) === 0 ? (
                  <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Sin reportes</CardContent></Card>
                ) : (
                  <div className="space-y-2">
                    {datos!.reportes.map((r: any) => (
                      <Card
                        key={r.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setReporteVer(r)}
                        onKeyDown={(e) => { if (e.key === "Enter") setReporteVer(r); }}
                        className="cursor-pointer hover:border-primary/40 transition-colors"
                      >
                        <CardContent className="p-3">
                          <div className="flex justify-between items-start gap-2 flex-wrap">
                            <div>
                              <b className="text-sm">{r.reporte_id}</b>
                              {r.tecnico && <span className="text-xs text-muted-foreground ml-2">{r.tecnico.nombre}</span>}
                            </div>
                            <span className="text-xs text-muted-foreground">{formatDate(r.fecha)}</span>
                          </div>
                          {r.descripcion && (
                            <div className="text-xs mt-1 line-clamp-2">{r.descripcion}</div>
                          )}
                          {r.fotos && r.fotos.length > 0 && (
                            <div className="text-xs text-primary mt-1">📷 {r.fotos.length} foto(s)</div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {puedeVerCostos && (
                <TabsContent value="horas">
                  <HorasTecnicasTab obraId={obraId} area={profile?.area ?? null} />
                </TabsContent>
              )}

              {puedeVerCostos && (
                <TabsContent value="costos">
                  <CostosTab costos={costos} horasObra={totalHorasParaCostos ?? null} area={profile?.area ?? null} />
                </TabsContent>
              )}
            </Tabs>
          </>
        )}
      <ExportarObraDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        obra={obra ?? null}
        reportes={(datos?.reportes ?? []) as any}
        costos={costos ?? null}
      />
      <ReporteDetalle
        open={!!reporteVer}
        onOpenChange={(o) => { if (!o) setReporteVer(null); }}
        reporte={reporteVer ? { ...reporteVer, obra: obra ?? null } : null}
      />
    </div>
  );
}

// ====== COSTOS TAB ======
function CostosTab({ costos, horasObra, area }: {
  costos: any;
  horasObra: TotalHorasObra | null;
  area: string | null;
}) {
  if (!costos) {
    return (
      <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">
        Cargando datos financieros...
      </CardContent></Card>
    );
  }

  // Direccion y Contabilidad ven la fila de horas técnicas
  const verHoras = ["Direccion", "Contabilidad", "Operaciones"].includes(area ?? "");
  const costoHoras = verHoras ? (horasObra?.costo_total ?? 0) : 0;
  const totalEjecutadoCostoConHoras = costos.total_ejecutado_costo + costoHoras;
  const totalEjecutadoListaConHoras = costos.total_ejecutado_lista + costoHoras;
  const margenCostoConHoras = costos.presupuesto - totalEjecutadoCostoConHoras;
  const margenCostoPctConHoras = costos.presupuesto > 0 ? (margenCostoConHoras / costos.presupuesto) * 100 : 0;
  const margenListaConHoras = costos.presupuesto - totalEjecutadoListaConHoras;

  return (
    <div className="space-y-4">
      {/* KPIs principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Presupuesto" value={formatCurrency(costos.presupuesto)} />
        <KpiCard label="Materiales" value={formatCurrency(costos.total_materiales_costo)} variant="primary" />
        <KpiCard label="OCs vinculadas (info)" value={formatCurrency(costos.total_ocs)} variant="default" />
        <KpiCard
          label="Margen"
          value={`${margenCostoConHoras >= 0 ? "+" : ""}${formatCurrency(margenCostoConHoras)}`}
          subtext={`(${margenCostoPctConHoras.toFixed(1)}%)`}
          variant={margenCostoConHoras >= 0 ? "success" : "destructive"}
        />
      </div>

      {/* Comparativa costo vs lista */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-3">Comparativa: Precio costo vs Precio lista</h3>
          <div className="space-y-2 text-sm">
            <ComparativaRow
              label="Presupuesto"
              costo={costos.presupuesto}
              lista={costos.presupuesto}
            />
            <ComparativaRow
              label="Materiales consumidos"
              costo={costos.total_materiales_costo}
              lista={costos.total_materiales_lista}
            />
            <ComparativaRow
              label="Compras (OCs) — informativo, no suma al total"
              costo={costos.total_ocs}
              lista={costos.total_ocs}
            />
            {verHoras && costoHoras > 0 && (
              <ComparativaRow
                label={`Horas técnicas (${(horasObra?.total_horas ?? 0).toFixed(2)} hs)`}
                costo={costoHoras}
                lista={costoHoras}
              />
            )}
            <div className="border-t border-border pt-2 mt-2">
              <ComparativaRow
                label="Total ejecutado"
                costo={totalEjecutadoCostoConHoras}
                lista={totalEjecutadoListaConHoras}
                bold
              />
              <ComparativaRow
                label="Margen estimado"
                costo={margenCostoConHoras}
                lista={margenListaConHoras}
                bold
                color={margenCostoConHoras >= 0 ? "success" : "destructive"}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Materiales */}
      {costos.materiales.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3">📦 Materiales consumidos ({costos.materiales.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b border-border">
                  <tr className="text-muted-foreground text-left">
                    <th className="py-2 pr-2">Ítem</th>
                    <th className="py-2 pr-2 text-right">Cant.</th>
                    <th className="py-2 pr-2 text-right">Costo total</th>
                    <th className="py-2 text-right">Lista total</th>
                  </tr>
                </thead>
                <tbody>
                  {costos.materiales.slice(0, 20).map((m: any) => (
                    <tr key={m.item_id} className="border-b border-border/50">
                      <td className="py-1.5 pr-2">
                        <div className="font-medium">{m.descripcion}</div>
                        <div className="text-muted-foreground">{m.item_codigo}</div>
                      </td>
                      <td className="py-1.5 pr-2 text-right">{m.cantidad_total} {m.unidad}</td>
                      <td className="py-1.5 pr-2 text-right">{formatCurrency(m.total_costo)}</td>
                      <td className="py-1.5 text-right">{formatCurrency(m.total_lista)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {costos.materiales.length > 20 && (
                <div className="text-xs text-muted-foreground mt-2 text-center">
                  Mostrando los 20 ítems con mayor costo · {costos.materiales.length - 20} más en el PDF detallado
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* OCs */}
      {costos.ocs.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3">🛒 Órdenes de compra vinculadas ({costos.ocs.length})</h3>
            <div className="space-y-1.5">
              {costos.ocs.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between text-xs p-2 rounded border border-border bg-secondary/30">
                  <div>
                    <span className="font-medium">{c.compra_id}</span>
                    {c.proveedor_nombre && <span className="text-muted-foreground"> · {c.proveedor_nombre}</span>}
                    <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] ${
                      c.estado === "Recibida" ? "bg-success/15 text-success" :
                      c.estado === "Cancelada" || c.estado === "Rechazada" ? "bg-muted text-muted-foreground" :
                      "bg-primary/15 text-primary"
                    }`}>{c.estado}</span>
                  </div>
                  <span className="font-semibold">{formatCurrency(c.total_estimado)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KpiCard({ label, value, subtext, variant = "default" }: {
  label: string; value: string; subtext?: string;
  variant?: "default" | "primary" | "success" | "destructive";
}) {
  const colors = {
    default: "text-foreground",
    primary: "text-primary",
    success: "text-success",
    destructive: "text-destructive",
  };
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className={`text-base sm:text-lg font-bold mt-1 ${colors[variant]}`}>{value}</div>
      {subtext && <div className={`text-xs ${colors[variant]}`}>{subtext}</div>}
    </div>
  );
}

function ComparativaRow({ label, costo, lista, bold, color }: {
  label: string; costo: number; lista: number;
  bold?: boolean;
  color?: "success" | "destructive";
}) {
  const colorCls = color === "success" ? "text-success"
    : color === "destructive" ? "text-destructive" : "";
  return (
    <div className={`grid grid-cols-[1fr_auto_auto] sm:grid-cols-3 gap-2 sm:gap-3 text-[12px] sm:text-sm ${bold ? "font-bold" : ""} ${colorCls}`}>
      <span className="truncate pr-1">{label}</span>
      <span className="text-right font-mono whitespace-nowrap">{formatCurrency(costo)}</span>
      <span className="text-right font-mono whitespace-nowrap">{formatCurrency(lista)}</span>
    </div>
  );
}

function HorasTecnicasTab({ obraId, area }: { obraId: string | null; area: string | null }) {
  const { data: porDia = [], isLoading: l1 } = useHorasPorDiaObra(obraId);
  const { data: totales, isLoading: l2 } = useTotalHorasObra(obraId);
  const { data: porTecnico = [] } = useHorasTecnicasObra(obraId);
  const verCosto = ["Direccion", "Contabilidad", "Operaciones"].includes(area ?? "");

  if (l1 || l2) {
    return (
      <div className="py-8 text-center">
        <Loader2 className="h-5 w-5 animate-spin mx-auto" />
      </div>
    );
  }

  if (porDia.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Aún no hay reportes con horas cargadas para esta obra.
        </CardContent>
      </Card>
    );
  }

  const diasTrabajados = porDia.length;

  return (
    <div className="space-y-4">
      {/* Resumen general */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <Card>
          <CardContent className="p-2 sm:p-3">
            <div className="text-[10px] sm:text-xs text-muted-foreground">Total horas</div>
            <div className="text-xl sm:text-2xl font-bold">{(totales?.total_horas ?? 0).toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2 sm:p-3">
            <div className="text-[10px] sm:text-xs text-muted-foreground">Técnicos</div>
            <div className="text-xl sm:text-2xl font-bold">{totales?.cantidad_tecnicos ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2 sm:p-3">
            <div className="text-[10px] sm:text-xs text-muted-foreground">Días trabajados</div>
            <div className="text-xl sm:text-2xl font-bold">{diasTrabajados}</div>
          </CardContent>
        </Card>
        {verCosto && (
          <Card>
            <CardContent className="p-2 sm:p-3">
              <div className="text-[10px] sm:text-xs text-muted-foreground">Costo total</div>
              <div className="text-base sm:text-2xl font-bold text-primary leading-tight">{formatCurrency(totales?.costo_total ?? 0)}</div>
              <div className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5">
                @ {formatCurrency(totales?.precio_hora_actual ?? 0)}/hr
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Detalle día por día */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">Detalle por día</h3>
        {porDia.map(d => {
          const horasHombre = d.horas_dia * d.cantidad_asistentes;
          return (
            <Card key={d.reporte_id}>
              <div className="p-2.5 sm:p-3 border-b bg-muted/30">
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                  <span className="font-semibold text-sm">{formatDate(d.fecha)}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-background border text-muted-foreground font-mono">
                    {d.hora_entrada?.slice(0, 5)} - {d.hora_salida?.slice(0, 5)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">· {d.reporte_codigo}</span>
                </div>
                <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2">
                  <span><b className="text-foreground">{horasHombre.toFixed(2)} hs</b></span>
                  <span>· {d.cantidad_asistentes} asistente{d.cantidad_asistentes !== 1 ? "s" : ""}</span>
                  {verCosto && <span>· <b className="text-primary">{formatCurrency(d.costo_dia)}</b></span>}
                </div>
              </div>
              <CardContent className="p-2.5 sm:p-3">
                {d.asistentes.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Sin asistentes registrados</p>
                ) : (
                  <div className="space-y-1">
                    {d.asistentes.map(a => (
                      <div key={a.id} className={cn("grid gap-2 text-xs sm:text-sm py-1 items-center",
                        verCosto ? "grid-cols-[1fr_60px_80px]" : "grid-cols-[1fr_70px]")}>
                        <span className="truncate">
                          {a.nombre}
                          <span className="text-[10px] text-muted-foreground ml-1">({a.area})</span>
                        </span>
                        <span className="text-right font-mono text-[11px] sm:text-xs">{d.horas_dia.toFixed(2)} hs</span>
                        {verCosto && (
                          <span className="text-right font-mono text-[11px] sm:text-xs text-muted-foreground">
                            {formatCurrency(d.horas_dia * (totales?.precio_hora_actual ?? 0))}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Resumen acumulado por técnico (al final) */}
      {porTecnico.length > 0 && (
        <Card>
          <CardContent className="p-2.5 sm:p-3">
            <h3 className="text-sm font-semibold mb-2">Acumulado por técnico</h3>
            <div className="space-y-1">
              <div className={cn("grid gap-2 text-[10px] sm:text-xs text-muted-foreground font-medium border-b pb-1",
                verCosto ? "grid-cols-[1fr_50px_60px_80px]" : "grid-cols-[1fr_60px_80px]")}>
                <span>Técnico</span>
                <span className="text-right">Días</span>
                <span className="text-right">Horas</span>
                {verCosto && <span className="text-right">Costo</span>}
              </div>
              {porTecnico.map(h => (
                <div key={h.tecnico_id} className={cn("grid gap-2 text-xs sm:text-sm py-1",
                  verCosto ? "grid-cols-[1fr_50px_60px_80px]" : "grid-cols-[1fr_60px_80px]")}>
                  <span className="font-medium truncate">{h.tecnico_nombre}</span>
                  <span className="text-right">{h.cantidad_reportes}</span>
                  <span className="text-right font-mono">{h.total_horas.toFixed(2)}</span>
                  {verCosto && (
                    <span className="text-right font-mono text-[11px] sm:text-xs">{formatCurrency(h.costo_total)}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RecomendacionesClienteBanner({ texto, prioridad, clienteNombre }: {
  texto: string;
  prioridad: "normal" | "importante" | "critico";
  clienteNombre: string;
}) {
  const estilos = {
    normal: {
      border: "border-primary/30", bg: "bg-primary/5",
      icon: "text-primary", titulo: "text-primary",
      label: "Recomendaciones",
    },
    importante: {
      border: "border-warning/40", bg: "bg-warning/10",
      icon: "text-warning", titulo: "text-warning",
      label: "⚠️ Importante",
    },
    critico: {
      border: "border-destructive/40", bg: "bg-destructive/10",
      icon: "text-destructive", titulo: "text-destructive",
      label: "🚨 Crítico",
    },
  }[prioridad];

  return (
    <div className={cn("rounded-lg border p-3 sm:p-4 mb-2", estilos.border, estilos.bg)}>
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className={cn("h-4 w-4 sm:h-5 sm:w-5", estilos.icon)} />
        <span className={cn("font-semibold text-sm", estilos.titulo)}>
          {estilos.label} — {clienteNombre}
        </span>
      </div>
      <div className="text-xs sm:text-sm whitespace-pre-line leading-relaxed text-foreground">
        {texto}
      </div>
    </div>
  );
}
