import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Briefcase, MapPin, Calendar, User, Users, Loader2, Clock,
  Wrench, ClipboardList, FileText, GitBranch, Wallet, FileDown,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useObra } from "./useObras";
import { useObraCostos } from "./useObraCostos";
import { useHorasTecnicasObra, useTotalHorasObra } from "./useHorasTecnicas";
import { ExportarObraDialog } from "./ExportarObraDialog";
import { useAuth } from "@/lib/auth";
import { puedeVerPrecios } from "@/lib/permissions";
import { supabase } from "@/lib/supabase";
import { formatDate, formatCurrency, cn } from "@/lib/utils";
import type { ObraConRelaciones, EstadoObra } from "@/types/database";
import { Link } from "react-router-dom";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  obraId: string | null;
}

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

export function ObraDetalle({ open, onOpenChange, obraId }: Props) {
  const { profile } = useAuth();
  const { data: obra, isLoading, error } = useObra(obraId ?? undefined);
  const { data: datos } = useObraDatos(obraId);

  // Direccion, Contabilidad y Comercial ven precios. Operaciones, Paniol y Tecnico NO.
  const puedeVerCostos = puedeVerPrecios(profile?.area);
  const verPrecios = puedeVerCostos;

  // Solo cargar costos si el usuario puede verlos (evita errores de RLS para técnicos)
  const { data: costos } = useObraCostos(puedeVerCostos ? obraId : null);
  const [exportOpen, setExportOpen] = useState(false);

  if (!obraId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto">
        {isLoading ? (
          <div className="py-12 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          </div>
        ) : error || !obra ? (
          <div className="py-12 text-center space-y-3">
            <p className="text-destructive font-medium">No se pudo cargar la obra</p>
            <p className="text-sm text-muted-foreground">
              {error?.message ?? "Es posible que no tengas permisos para verla."}
            </p>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <span className="text-xl sm:text-2xl">{obra.obra_id}</span>
                <span className={cn("px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold border whitespace-nowrap", ESTADO_COLOR[obra.estado])}>
                  {obra.estado}
                </span>
              </DialogTitle>
              <DialogDescription>
                <span className="font-medium text-foreground">{obra.cliente?.nombre}</span>
                {obra.nombre_obra && <> · {obra.nombre_obra}</>}
              </DialogDescription>
              <div className="pt-2">
                <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
                  <FileDown className="h-3.5 w-3.5" />
                  Exportar PDF
                </Button>
              </div>
            </DialogHeader>

            <Tabs defaultValue="resumen">
              <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 pb-1">
                <TabsList className="w-max">
                  <TabsTrigger value="resumen">📋 Resumen</TabsTrigger>
                  <TabsTrigger value="solicitudes">
                    <ClipboardList className="h-3.5 w-3.5 mr-1" />
                    Solicitudes ({datos?.solicitudes.length ?? 0})
                  </TabsTrigger>
                  <TabsTrigger value="movimientos">
                    <GitBranch className="h-3.5 w-3.5 mr-1" />
                    Movimientos ({datos?.movimientos.length ?? 0})
                  </TabsTrigger>
                  <TabsTrigger value="reportes">
                    <FileText className="h-3.5 w-3.5 mr-1" />
                    Reportes ({datos?.reportes.length ?? 0})
                  </TabsTrigger>
                  {puedeVerCostos && (
                    <TabsTrigger value="horas">
                      <Clock className="h-3.5 w-3.5 mr-1" />
                      Horas técnicas
                    </TabsTrigger>
                  )}
                  {puedeVerCostos && (
                    <TabsTrigger value="costos">
                      <Wallet className="h-3.5 w-3.5 mr-1" />
                      Costos
                    </TabsTrigger>
                  )}
                </TabsList>
              </div>

              <TabsContent value="resumen" className="space-y-4">
                <ResumenObra obra={obra} verPrecios={verPrecios} />
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
                      <Card key={r.id}>
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
                  <CostosTab costos={costos} />
                </TabsContent>
              )}
            </Tabs>
          </>
        )}
      </DialogContent>
      <ExportarObraDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        obra={obra ?? null}
        reportes={(datos?.reportes ?? []) as any}
        costos={costos ?? null}
      />
    </Dialog>
  );
}

function ResumenObra({ obra, verPrecios }: { obra: ObraConRelaciones; verPrecios: boolean }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {obra.cliente && (
          <InfoRow icon={<Users className="h-4 w-4" />} label="Cliente" value={obra.cliente.nombre} />
        )}
        {obra.sitio && (
          <InfoRow icon={<MapPin className="h-4 w-4" />} label="Sitio" value={obra.sitio} />
        )}
        {obra.jefe_obra && (
          <InfoRow icon={<User className="h-4 w-4" />} label="Jefe de obra" value={obra.jefe_obra.nombre} />
        )}
        {verPrecios && obra.presupuesto > 0 && (
          <InfoRow icon={<Wallet className="h-4 w-4" />} label="Presupuesto" value={formatCurrency(obra.presupuesto)} />
        )}
        {obra.fecha_inicio_est && (
          <InfoRow icon={<Calendar className="h-4 w-4" />} label="Inicio estimado" value={formatDate(obra.fecha_inicio_est)} />
        )}
        {obra.fecha_fin_est && (
          <InfoRow icon={<Calendar className="h-4 w-4" />} label="Fin estimado" value={formatDate(obra.fecha_fin_est)} />
        )}
        {obra.fecha_inicio_real && (
          <InfoRow icon={<Calendar className="h-4 w-4 text-success" />} label="Inicio real" value={formatDate(obra.fecha_inicio_real)} />
        )}
        {obra.fecha_fin_real && (
          <InfoRow icon={<Calendar className="h-4 w-4 text-primary" />} label="Fin real" value={formatDate(obra.fecha_fin_real)} />
        )}
      </div>

      {obra.alcance_tecnico && (
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Alcance técnico</div>
            <div className="text-sm whitespace-pre-wrap">{obra.alcance_tecnico}</div>
          </CardContent>
        </Card>
      )}

      {obra.tecnicos && obra.tecnicos.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
              Técnicos asignados ({obra.tecnicos.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {obra.tecnicos.map((t: any) => (
                <span key={t.id} className="px-2 py-1 rounded-md text-xs bg-secondary border">
                  👤 {t.nombre}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {obra.observaciones && (
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Observaciones</div>
            <div className="text-sm whitespace-pre-wrap">{obra.observaciones}</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="text-muted-foreground mt-0.5">{icon}</div>
      <div className="flex-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium break-words">{value}</div>
      </div>
    </div>
  );
}

// ====== COSTOS TAB ======
function CostosTab({ costos }: { costos: any }) {
  if (!costos) {
    return (
      <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">
        Cargando datos financieros...
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Presupuesto" value={formatCurrency(costos.presupuesto)} />
        <KpiCard label="Materiales" value={formatCurrency(costos.total_materiales_costo)} variant="primary" />
        <KpiCard label="OCs vinculadas" value={formatCurrency(costos.total_ocs)} variant="primary" />
        <KpiCard
          label="Margen"
          value={`${costos.margen_costo >= 0 ? "+" : ""}${formatCurrency(costos.margen_costo)}`}
          subtext={`(${costos.margen_costo_pct.toFixed(1)}%)`}
          variant={costos.margen_costo >= 0 ? "success" : "destructive"}
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
              label="Compras (OCs)"
              costo={costos.total_ocs}
              lista={costos.total_ocs}
            />
            <div className="border-t border-border pt-2 mt-2">
              <ComparativaRow
                label="Total ejecutado"
                costo={costos.total_ejecutado_costo}
                lista={costos.total_ejecutado_lista}
                bold
              />
              <ComparativaRow
                label="Margen estimado"
                costo={costos.margen_costo}
                lista={costos.margen_lista}
                bold
                color={costos.margen_costo >= 0 ? "success" : "destructive"}
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
    <div className={`grid grid-cols-3 gap-2 ${bold ? "font-bold" : ""} ${colorCls}`}>
      <span>{label}</span>
      <span className="text-right">{formatCurrency(costo)}</span>
      <span className="text-right">{formatCurrency(lista)}</span>
    </div>
  );
}

function HorasTecnicasTab({ obraId, area }: { obraId: string | null; area: string | null }) {
  const { data: horasPorTecnico = [], isLoading: l1 } = useHorasTecnicasObra(obraId);
  const { data: totales, isLoading: l2 } = useTotalHorasObra(obraId);
  const verCosto = area === "Direccion";

  if (l1 || l2) {
    return (
      <div className="py-8 text-center">
        <Loader2 className="h-5 w-5 animate-spin mx-auto" />
      </div>
    );
  }

  if (horasPorTecnico.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Aún no hay reportes con horas cargadas para esta obra.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumen general */}
      <div className={cn("grid gap-3", verCosto ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3")}>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Total horas</div>
            <div className="text-2xl font-bold">{totales?.total_horas.toFixed(2) ?? "0.00"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Técnicos</div>
            <div className="text-2xl font-bold">{totales?.cantidad_tecnicos ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Reportes</div>
            <div className="text-2xl font-bold">{totales?.cantidad_reportes ?? 0}</div>
          </CardContent>
        </Card>
        {verCosto && (
          <Card>
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Costo total</div>
              <div className="text-2xl font-bold text-primary">{formatCurrency(totales?.costo_total ?? 0)}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                @ {formatCurrency(totales?.precio_hora_actual ?? 0)}/hr
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Desglose por técnico */}
      <Card>
        <CardContent className="p-3">
          <h3 className="text-sm font-semibold mb-2">Por técnico</h3>
          <div className="space-y-1">
            <div className={cn("grid gap-2 text-xs text-muted-foreground font-medium border-b pb-1",
              verCosto ? "grid-cols-[1fr_70px_70px_100px]" : "grid-cols-[1fr_70px_90px]")}>
              <span>Técnico</span>
              <span className="text-right">Reportes</span>
              <span className="text-right">Horas</span>
              {verCosto && <span className="text-right">Costo</span>}
            </div>
            {horasPorTecnico.map(h => (
              <div key={h.tecnico_id} className={cn("grid gap-2 text-sm py-1",
                verCosto ? "grid-cols-[1fr_70px_70px_100px]" : "grid-cols-[1fr_70px_90px]")}>
                <span className="font-medium">{h.tecnico_nombre}</span>
                <span className="text-right">{h.cantidad_reportes}</span>
                <span className="text-right font-mono">{h.total_horas.toFixed(2)}</span>
                {verCosto && (
                  <span className="text-right font-mono">{formatCurrency(h.costo_total)}</span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
