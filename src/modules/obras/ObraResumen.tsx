import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Building2, UserCog, Calendar, CalendarCheck, MapPin, Wallet, Pencil, Map as MapIcon,
  FileText, Image, Users, History, Play, Lock, CheckCircle, RotateCcw, Loader2, MessageCircle, Check,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { formatDate, formatCurrency, cn } from "@/lib/utils";
import type { ObraConRelaciones, EstadoObra } from "@/types/database";
import {
  useObraHistorial, useCambiarEstadoObra, useCerrarObra, useFinalizarObra, useReabrirObra,
  comentarCambioEstado,
} from "./useObras";
import { AvisarWhatsAppDialog } from "./AvisarWhatsAppDialog";
import { CostosExtrasDialog } from "./CostosExtrasDialog";
import { ObraDialog } from "./ObraDialog";

// ====== Flujo de estados ======

const ETAPAS: { estado: EstadoObra; label: string }[] = [
  { estado: "Pendiente OIO", label: "Pendiente OIO" },
  { estado: "En ejecucion", label: "Ejecución" },
  { estado: "Para cierre", label: "Cierre" },
  { estado: "Cerrada", label: "Cerrada" },
];

const ETIQUETA_ESTADO: Record<string, string> = {
  "Pendiente OIO": "Pendiente OIO",
  "En ejecucion": "En ejecución",
  "Para cierre": "Para cierre",
  "Cerrada": "Cerrada",
  "Cancelada": "Cancelada",
};

interface Transicion {
  estado: EstadoObra;
  titulo: string;
  descripcion: string;
  icon: React.ComponentType<{ className?: string }>;
  soloDireccion?: boolean;
}

// Mismo flujo que los botones de la lista de obras
const TRANSICIONES: Partial<Record<EstadoObra, Transicion[]>> = {
  "Pendiente OIO": [
    { estado: "En ejecucion", titulo: "En ejecución", descripcion: "Iniciar los trabajos de la obra", icon: Play },
  ],
  "En ejecucion": [
    {
      estado: "Para cierre", titulo: "Para cierre", icon: Lock,
      descripcion: "Genera las devoluciones de herramientas y cancela solicitudes pendientes",
    },
  ],
  "Para cierre": [
    {
      estado: "Cerrada", titulo: "Cerrada", icon: CheckCircle,
      descripcion: "Finalizar la obra (verificá que pañol procesó las devoluciones)",
    },
  ],
  "Cerrada": [
    {
      estado: "En ejecucion", titulo: "Reabrir", icon: RotateCcw, soloDireccion: true,
      descripcion: "Vuelve a En ejecución para editar o cargar gastos",
    },
  ],
};

/** Avance estimado: por etapa y, durante la ejecución, según las fechas estimadas. */
function calcularProgreso(obra: ObraConRelaciones): number {
  switch (obra.estado) {
    case "Pendiente OIO": return 0;
    case "Para cierre": return 90;
    case "Cerrada": return 100;
    case "En ejecucion": {
      const ini = obra.fecha_inicio_real ?? obra.fecha_inicio_est;
      const fin = obra.fecha_fin_est;
      if (!ini || !fin) return 50;
      const total = new Date(fin).getTime() - new Date(ini).getTime();
      const transcurrido = Date.now() - new Date(ini).getTime();
      const frac = total > 0 ? Math.min(Math.max(transcurrido / total, 0), 1) : 1;
      return Math.round(25 + frac * 60); // 25% al iniciar, 85% en la fecha de fin
    }
    default: return 0;
  }
}

function formatFechaHora(iso: string): string {
  const d = new Date(iso);
  const hoy = new Date();
  const hora = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === hoy.toDateString()) return `Hoy, ${hora}`;
  return `${formatDate(iso)} - ${hora}`;
}

// ====== Componente ======

interface Props {
  obra: ObraConRelaciones;
  verPrecios: boolean;
  cantidadReportes: number;
  cantidadFotos: number;
  onVerReportes: () => void;
}

export function ObraResumen({ obra, verPrecios, cantidadReportes, cantidadFotos, onVerReportes }: Props) {
  const { profile } = useAuth();
  const area = profile?.area ?? "";
  const puedeEditar = ["Direccion", "Operaciones", "Comercial"].includes(area) && obra.estado !== "Cerrada";
  const puedeCambiarEstado = ["Direccion", "Operaciones", "Contabilidad"].includes(area);
  const puedeAvisar = area !== "Tecnico";

  const [editarOpen, setEditarOpen] = useState(false);
  const [avisoOpen, setAvisoOpen] = useState(false);

  const progreso = calcularProgreso(obra);
  const etapaActual = ETAPAS.findIndex(e => e.estado === obra.estado);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Columna principal */}
        <div className="lg:col-span-2 space-y-4">
          {/* Ficha */}
          <Card>
            <CardContent className="p-4 sm:p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
                    ID obra: {obra.obra_id}
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight break-words mt-0.5">
                    {obra.nombre_obra || "Obra sin nombre"}
                  </h2>
                </div>
                {puedeEditar && (
                  <Button
                    variant="ghost" size="icon" className="h-8 w-8 text-primary shrink-0"
                    title="Editar obra" onClick={() => setEditarOpen(true)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <DatoTile icon={Building2} label="Cliente" value={obra.cliente?.nombre} />
                <DatoTile icon={UserCog} label="Jefe de obra" value={obra.jefe_obra?.nombre} />
                <DatoTile
                  icon={Calendar} label={obra.fecha_inicio_real ? "Fecha inicio (real)" : "Fecha inicio"}
                  value={formatDate(obra.fecha_inicio_real ?? obra.fecha_inicio_est)}
                />
                <DatoTile
                  icon={CalendarCheck} label={obra.fecha_fin_real ? "Fecha fin (real)" : "Fecha estimada fin"}
                  value={formatDate(obra.fecha_fin_real ?? obra.fecha_fin_est)}
                />
                <DatoTile icon={MapPin} label="Sitio" value={obra.sitio} />
                {verPrecios && (
                  <DatoTile
                    icon={Wallet} label="Presupuesto"
                    value={obra.presupuesto > 0 ? formatCurrency(obra.presupuesto) : null}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Progreso */}
          <Card>
            <CardContent className="p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                  Progreso de la obra
                </div>
                <div className={cn(
                  "text-2xl font-bold",
                  obra.estado === "Cancelada" ? "text-destructive" : "text-primary",
                )}>
                  {obra.estado === "Cancelada" ? "Cancelada" : `${progreso}%`}
                </div>
              </div>
              <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    obra.estado === "Cancelada" ? "bg-destructive/60" : "bg-primary",
                  )}
                  style={{ width: `${obra.estado === "Cancelada" ? 100 : progreso}%` }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {ETAPAS.map((e, i) => {
                  const estadoEtapa =
                    obra.estado === "Cancelada" ? "—"
                      : i < etapaActual || obra.estado === "Cerrada" ? "Completado"
                      : i === etapaActual ? "En curso"
                      : "Pendiente";
                  return (
                    <span
                      key={e.estado}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-[11px] border",
                        estadoEtapa === "Completado" && "bg-success/10 text-success border-success/30",
                        estadoEtapa === "En curso" && "bg-primary/10 text-primary border-primary/30 font-medium",
                        (estadoEtapa === "Pendiente" || estadoEtapa === "—") && "bg-secondary/40 text-muted-foreground border-border",
                      )}
                    >
                      {e.label}: {estadoEtapa}
                    </span>
                  );
                })}
              </div>
              {obra.estado === "En ejecucion" && (
                <p className="text-[11px] text-muted-foreground">
                  El avance en ejecución se estima según las fechas de inicio y fin.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Cambiar estado */}
        <CambiarEstadoCard obra={obra} puedeCambiar={puedeCambiarEstado} esDireccion={area === "Direccion"} />
      </div>

      {/* Historial */}
      <HistorialCard obraId={obra.id} />

      {/* Accesos rápidos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <AccesoTile
          icon={MapIcon} label="Ubicación"
          value={obra.maps_url ? "Ver en mapa" : "Sin ubicación"}
          href={obra.maps_url ?? undefined}
        />
        <AccesoTile
          icon={FileText} label="Reportes"
          value={`${cantidadReportes} reporte${cantidadReportes === 1 ? "" : "s"}`}
          onClick={cantidadReportes > 0 ? onVerReportes : undefined}
        />
        <AccesoTile
          icon={Image} label="Evidencia"
          value={`${cantidadFotos} imagen${cantidadFotos === 1 ? "" : "es"}`}
          onClick={cantidadFotos > 0 ? onVerReportes : undefined}
        />
        <AccesoTile
          icon={Users} label="Equipo"
          value={`${obra.tecnicos?.length ?? 0} técnico${obra.tecnicos?.length === 1 ? "" : "s"}`}
        />
      </div>

      {/* Alcance */}
      {obra.alcance_tecnico && (
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Alcance técnico</div>
            <div className="text-sm whitespace-pre-wrap">{obra.alcance_tecnico}</div>
          </CardContent>
        </Card>
      )}

      {/* Equipo asignado */}
      {obra.tecnicos && obra.tecnicos.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">
                Técnicos asignados ({obra.tecnicos.length})
              </div>
              {puedeAvisar && (
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setAvisoOpen(true)}>
                  <MessageCircle className="h-3.5 w-3.5 text-[#25D366]" />
                  Avisar por WhatsApp
                </Button>
              )}
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

      <AvisarWhatsAppDialog
        open={avisoOpen}
        onOpenChange={setAvisoOpen}
        obra={{
          ...obra,
          cliente_nombre: obra.cliente?.nombre ?? null,
          jefe_nombre: obra.jefe_obra?.nombre ?? null,
        }}
        tecnicos={obra.tecnicos ?? []}
      />
      {puedeEditar && <ObraDialog open={editarOpen} onOpenChange={setEditarOpen} obra={obra} />}
    </div>
  );
}

// ====== Cambiar estado ======

function CambiarEstadoCard({ obra, puedeCambiar, esDireccion }: {
  obra: ObraConRelaciones;
  puedeCambiar: boolean;
  esDireccion: boolean;
}) {
  const qc = useQueryClient();
  const cambiarEstado = useCambiarEstadoObra();
  const cerrarObra = useCerrarObra();
  const finalizarObra = useFinalizarObra();
  const reabrirObra = useReabrirObra();

  const [seleccion, setSeleccion] = useState<Transicion | null>(null);
  const [comentario, setComentario] = useState("");
  const [costosExtrasOpen, setCostosExtrasOpen] = useState(false);

  const opciones = (TRANSICIONES[obra.estado] ?? []).filter(t => !t.soloDireccion || esDireccion);
  const loading = cambiarEstado.isPending || cerrarObra.isPending || finalizarObra.isPending || reabrirObra.isPending;

  const terminar = async (mensaje: string) => {
    try {
      await comentarCambioEstado(obra.id, comentario);
    } catch (e: any) {
      toast.warning("El estado cambió, pero no se guardó el comentario: " + e.message);
    }
    qc.invalidateQueries({ queryKey: ["obras"] });
    toast.success(mensaje);
    setSeleccion(null);
    setComentario("");
  };

  const ejecutar = async () => {
    if (!seleccion) return;
    try {
      if (obra.estado === "Pendiente OIO") {
        await cambiarEstado.mutateAsync({ id: obra.id, estado: "En ejecucion" });
        await terminar(`${obra.obra_id} en ejecución`);
      } else if (obra.estado === "En ejecucion") {
        // Igual que en la lista: primero se cargan costos extras, después se cierra
        setCostosExtrasOpen(true);
      } else if (obra.estado === "Para cierre") {
        await finalizarObra.mutateAsync(obra.id);
        await terminar(`${obra.obra_id} cerrada`);
      } else if (obra.estado === "Cerrada") {
        await reabrirObra.mutateAsync(obra.id);
        await terminar(`${obra.obra_id} reabierta`);
      }
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  const iniciarCierre = async () => {
    setCostosExtrasOpen(false);
    try {
      const r = await cerrarObra.mutateAsync({ id: obra.id });
      await terminar(
        `Obra en cierre: ${r.herramientas_generadas} devoluciones generadas` +
        (r.materiales_pendientes > 0 ? ` · ${r.materiales_pendientes} materiales para revisar` : ""),
      );
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  return (
    <Card>
      <CardContent className="p-4 sm:p-5 space-y-3">
        <div>
          <h3 className="text-lg font-semibold">Cambiar estado</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {puedeCambiar
              ? "Seleccioná el nuevo estado para actualizar el flujo de trabajo."
              : "Solo Dirección, Operaciones y Contabilidad pueden cambiar el estado."}
          </p>
        </div>

        {/* Estado actual */}
        <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/40 bg-primary/5">
          <div className="h-9 w-9 rounded-md bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <Check className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold">{ETIQUETA_ESTADO[obra.estado]}</div>
            <div className="text-[11px] text-muted-foreground">Estado actual</div>
          </div>
        </div>

        {puedeCambiar && opciones.map(t => {
          const activa = seleccion?.estado === t.estado && seleccion.titulo === t.titulo;
          return (
            <button
              key={t.titulo}
              type="button"
              onClick={() => setSeleccion(activa ? null : t)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors",
                activa ? "border-primary bg-primary/10" : "border-border hover:bg-accent",
              )}
            >
              <div className="h-9 w-9 rounded-md bg-secondary flex items-center justify-center shrink-0">
                <t.icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{t.titulo}</div>
                <div className="text-[11px] text-muted-foreground">{t.descripcion}</div>
              </div>
              {activa && <Check className="h-4 w-4 text-primary shrink-0" />}
            </button>
          );
        })}

        {puedeCambiar && opciones.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No hay cambios de estado disponibles.</p>
        )}

        {puedeCambiar && seleccion && (
          <Textarea
            rows={2}
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Motivo o comentario (opcional, queda en el historial)"
            className="text-sm"
          />
        )}

        {puedeCambiar && opciones.length > 0 && (
          <Button className="w-full uppercase tracking-wider" disabled={!seleccion || loading} onClick={ejecutar}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmar cambio
          </Button>
        )}
      </CardContent>

      <CostosExtrasDialog
        open={costosExtrasOpen}
        onOpenChange={setCostosExtrasOpen}
        obra={obra}
        onContinuar={iniciarCierre}
      />
    </Card>
  );
}

// ====== Historial ======

function HistorialCard({ obraId }: { obraId: string }) {
  const { data: historial = [], isLoading, error } = useObraHistorial(obraId);

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <History className="h-5 w-5 text-primary" />
        Historial de cambios
      </h3>
      <Card>
        <CardContent className="p-4 sm:p-5">
          {isLoading ? (
            <div className="py-4 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></div>
          ) : error ? (
            <p className="text-sm text-muted-foreground">
              No se pudo cargar el historial. ¿Se corrió el script <code>sql/064_obra_historial.sql</code> y <code>sql/065_renombrar_historial_cambios_obras.sql</code>?
            </p>
          ) : historial.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin cambios registrados.</p>
          ) : (
            <ol className="relative">
              {historial.map((h, i) => {
                const ultimo = i === historial.length - 1;
                const titulo = h.tipo === "creada"
                  ? "Obra creada"
                  : `Estado cambiado a: ${ETIQUETA_ESTADO[h.estado_nuevo ?? ""] ?? h.estado_nuevo}`;
                return (
                  <li key={h.id} className="relative flex gap-3 pb-5 last:pb-0">
                    {/* Línea de tiempo */}
                    {!ultimo && <span className="absolute left-[5px] top-4 bottom-0 w-px bg-border" />}
                    <span className={cn(
                      "relative mt-1.5 h-[11px] w-[11px] rounded-full shrink-0 border-2",
                      i === 0 ? "bg-primary border-primary/40" : "bg-muted-foreground/40 border-transparent",
                    )} />
                    <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:justify-between gap-1">
                      <div className="min-w-0">
                        <div className={cn("text-sm font-semibold", i === 0 && "text-primary")}>{titulo}</div>
                        {h.tipo === "estado" && h.estado_anterior && (
                          <div className="text-[11px] text-muted-foreground">
                            Antes: {ETIQUETA_ESTADO[h.estado_anterior] ?? h.estado_anterior}
                          </div>
                        )}
                        {h.comentario && <div className="text-sm text-muted-foreground mt-0.5">{h.comentario}</div>}
                      </div>
                      <div className="sm:text-right shrink-0">
                        <div className={cn("text-xs font-medium", i === 0 ? "text-warning" : "text-foreground")}>
                          {formatFechaHora(h.created_at)}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Por: {h.usuario?.nombre ?? "Sistema"}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ====== Tiles ======

function DatoTile({ icon: Icon, label, value }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null | undefined;
}) {
  const vacio = !value || value === "—";
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-secondary/20">
      <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className={cn("text-sm font-semibold break-words", vacio && "text-muted-foreground italic font-normal")}>
          {vacio ? "Sin cargar" : value}
        </div>
      </div>
    </div>
  );
}

function AccesoTile({ icon: Icon, label, value, href, onClick }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  href?: string;
  onClick?: () => void;
}) {
  const contenido = (
    <>
      <div className="h-10 w-10 rounded-md bg-secondary flex items-center justify-center shrink-0">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="min-w-0 text-left">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold truncate">{value}</div>
      </div>
    </>
  );
  const clases = "flex items-center gap-3 p-3 rounded-lg border bg-card w-full";
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cn(clases, "hover:border-primary/40 transition-colors")}>
        {contenido}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(clases, "hover:border-primary/40 transition-colors")}>
        {contenido}
      </button>
    );
  }
  return <div className={clases}>{contenido}</div>;
}
