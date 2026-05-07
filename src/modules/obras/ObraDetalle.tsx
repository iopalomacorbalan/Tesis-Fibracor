import { useQuery } from "@tanstack/react-query";
import {
  Briefcase, MapPin, Calendar, User, Users, Loader2,
  Wrench, ClipboardList, FileText, GitBranch, Wallet,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useObra } from "./useObras";
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
  const { data: obra, isLoading } = useObra(obraId ?? undefined);
  const { data: datos } = useObraDatos(obraId);

  if (!obraId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto">
        {isLoading || !obra ? (
          <div className="py-12 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 flex-wrap">
                <span className="text-2xl">{obra.obra_id}</span>
                <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold border", ESTADO_COLOR[obra.estado])}>
                  {obra.estado}
                </span>
              </DialogTitle>
              <DialogDescription>
                <span className="font-medium text-foreground">{obra.cliente?.nombre}</span>
                {obra.nombre_obra && <> · {obra.nombre_obra}</>}
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="resumen">
              <TabsList>
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
              </TabsList>

              <TabsContent value="resumen" className="space-y-4">
                <ResumenObra obra={obra} />
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
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ResumenObra({ obra }: { obra: ObraConRelaciones }) {
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
        {obra.presupuesto > 0 && (
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
        <div className="text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}
