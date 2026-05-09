import { useState, useMemo } from "react";
import {
  Plus, Search, Filter, MoreVertical, Edit, Trash2, Eye,
  Briefcase, MapPin, Calendar, User, AlertCircle,
  Play, CheckCircle, Lock, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  useObras, useEliminarObra, useCambiarEstadoObra,
  useCerrarObra, useFinalizarObra,
} from "./useObras";
import { ObraDialog } from "./ObraDialog";
import { ObraDetalle } from "./ObraDetalle";
import { CostosExtrasDialog } from "./CostosExtrasDialog";
import { formatDate, formatCurrency, cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import type { ObraConRelaciones, EstadoObra } from "@/types/database";

const ESTADOS: { value: EstadoObra | "todos"; label: string; color: string }[] = [
  { value: "todos", label: "Todas", color: "" },
  { value: "Pendiente OIO", label: "Pendiente OIO", color: "bg-warning/15 text-warning border-warning/30" },
  { value: "En ejecucion", label: "En ejecución", color: "bg-success/15 text-success border-success/30" },
  { value: "Para cierre", label: "Para cierre", color: "bg-primary/15 text-primary border-primary/30" },
  { value: "Cerrada", label: "Cerrada", color: "bg-muted text-muted-foreground border-border" },
  { value: "Cancelada", label: "Cancelada", color: "bg-destructive/15 text-destructive border-destructive/30" },
];

function estadoStyle(estado: EstadoObra): string {
  return ESTADOS.find(e => e.value === estado)?.color ?? "bg-muted";
}

export default function ObrasPage() {
  const { profile } = useAuth();
  const { data: obras = [], isLoading, error } = useObras();
  const eliminarObra = useEliminarObra();
  const cambiarEstado = useCambiarEstadoObra();
  const cerrarObra = useCerrarObra();
  const finalizarObra = useFinalizarObra();

  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<EstadoObra | "todos">("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [obraEditar, setObraEditar] = useState<ObraConRelaciones | null>(null);
  const [obraEliminar, setObraEliminar] = useState<ObraConRelaciones | null>(null);
  const [obraDetalle, setObraDetalle] = useState<ObraConRelaciones | null>(null);
  const [obraExtras, setObraExtras] = useState<ObraConRelaciones | null>(null); // paso 1: costos extras
  const [obraCerrar, setObraCerrar] = useState<ObraConRelaciones | null>(null); // paso 2: confirmar
  const [obraFinalizar, setObraFinalizar] = useState<ObraConRelaciones | null>(null);

  const puedeEditar = profile && ["Direccion", "Operaciones", "Comercial"].includes(profile.area);
  const puedeEliminar = profile?.area === "Direccion";
  const puedeCerrar = profile && ["Direccion", "Operaciones"].includes(profile.area);

  const obrasFiltradas = useMemo(() => {
    return obras.filter(o => {
      if (filtroEstado !== "todos" && o.estado !== filtroEstado) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          o.obra_id.toLowerCase().includes(s) ||
          (o.nombre_obra?.toLowerCase().includes(s) ?? false) ||
          (o.cliente?.nombre?.toLowerCase().includes(s) ?? false) ||
          (o.sitio?.toLowerCase().includes(s) ?? false)
        );
      }
      return true;
    });
  }, [obras, search, filtroEstado]);

  const handleEliminar = async () => {
    if (!obraEliminar) return;
    try {
      await eliminarObra.mutateAsync(obraEliminar.id);
      toast.success(`Obra ${obraEliminar.obra_id} eliminada`);
      setObraEliminar(null);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  const handleEditarObra = (o: ObraConRelaciones) => {
    setObraEditar(o);
    setDialogOpen(true);
  };

  const handleNuevaObra = () => {
    setObraEditar(null);
    setDialogOpen(true);
  };

  const stats = useMemo(() => ({
    total: obras.length,
    activas: obras.filter(o => o.estado === "En ejecucion").length,
    pendientes: obras.filter(o => o.estado === "Pendiente OIO").length,
    cerradas: obras.filter(o => o.estado === "Cerrada").length,
  }), [obras]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
            <Briefcase className="h-8 w-8 text-primary" />
            Obras
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestión de órdenes de trabajo y proyectos
          </p>
        </div>
        {puedeEditar && (
          <Button onClick={handleNuevaObra} size="lg">
            <Plus className="h-4 w-4" />
            Nueva obra
          </Button>
        )}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="En ejecución" value={stats.activas} variant="success" />
        <StatCard label="Pendientes OIO" value={stats.pendientes} variant="warning" />
        <StatCard label="Cerradas" value={stats.cerradas} variant="muted" />
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[280px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por ID, nombre, cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroEstado} onValueChange={(v: any) => setFiltroEstado(v)}>
          <SelectTrigger className="w-[200px]">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ESTADOS.map(e => (
              <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">Cargando obras...</CardContent></Card>
      ) : error ? (
        <Card className="border-destructive">
          <CardContent className="py-8 flex items-center gap-3 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <div>
              <div className="font-semibold">Error al cargar obras</div>
              <div className="text-sm">{(error as Error).message}</div>
            </div>
          </CardContent>
        </Card>
      ) : obrasFiltradas.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Briefcase className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            {obras.length === 0 ? (
              <>
                <p className="text-muted-foreground">No hay obras registradas</p>
                {puedeEditar && (
                  <Button onClick={handleNuevaObra} className="mt-4">
                    <Plus className="h-4 w-4" />
                    Crear primera obra
                  </Button>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">No hay obras que coincidan con los filtros</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {obrasFiltradas.map(o => (
            <ObraCard
              key={o.id}
              obra={o}
              puedeEditar={!!puedeEditar}
              puedeEliminar={!!puedeEliminar}
              puedeCerrar={!!puedeCerrar}
              onVer={(o) => setObraDetalle(o)}
              onEditar={handleEditarObra}
              onEliminar={(o) => setObraEliminar(o)}
              onIniciar={(o) => cambiarEstado.mutate({ id: o.id, estado: "En ejecucion" })}
              onParaCierre={(o) => setObraExtras(o)}
              onFinalizar={(o) => setObraFinalizar(o)}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <ObraDialog open={dialogOpen} onOpenChange={setDialogOpen} obra={obraEditar} />
      <ObraDetalle
        open={!!obraDetalle}
        onOpenChange={(o) => !o && setObraDetalle(null)}
        obraId={obraDetalle?.id ?? null}
      />

      {/* Paso 1: Costos extras antes del cierre */}
      <CostosExtrasDialog
        open={!!obraExtras}
        onOpenChange={(o) => !o && setObraExtras(null)}
        obra={obraExtras}
        onContinuar={() => {
          if (obraExtras) {
            setObraCerrar(obraExtras);
            setObraExtras(null);
          }
        }}
      />

      {/* Iniciar cierre (genera devoluciones automáticas) */}
      <ConfirmDialog
        open={!!obraCerrar}
        onOpenChange={(o) => !o && setObraCerrar(null)}
        title={`¿Iniciar cierre de ${obraCerrar?.obra_id}?`}
        description={
          "Esto va a:\n" +
          "• Generar devoluciones pendientes automáticamente para todas las herramientas que los técnicos tengan asignadas en esta obra\n" +
          "• Cancelar las solicitudes pendientes/parciales de la obra\n" +
          "• Marcar la obra como 'Para cierre'\n\n" +
          "Después, pañol procesará cada devolución y cuando todas estén OK, podés finalizar la obra."
        }
        confirmText="Iniciar cierre"
        loading={cerrarObra.isPending}
        onConfirm={async () => {
          if (!obraCerrar) return;
          try {
            const r = await cerrarObra.mutateAsync({ id: obraCerrar.id });
            toast.success(
              `Obra en cierre: ${r.herramientas_generadas} devoluciones generadas` +
              (r.materiales_pendientes > 0 ? ` · ${r.materiales_pendientes} materiales para revisar` : "")
            );
            setObraCerrar(null);
          } catch (e: any) {
            toast.error("Error: " + e.message);
          }
        }}
      />

      {/* Finalizar (de Para cierre → Cerrada) */}
      <ConfirmDialog
        open={!!obraFinalizar}
        onOpenChange={(o) => !o && setObraFinalizar(null)}
        title={`¿Finalizar ${obraFinalizar?.obra_id}?`}
        description="Asegurate que todas las devoluciones pendientes se hayan procesado. Esta acción marca la obra como Cerrada (no podrás hacer cambios después)."
        confirmText="Finalizar obra"
        loading={finalizarObra.isPending}
        onConfirm={async () => {
          if (!obraFinalizar) return;
          try {
            await finalizarObra.mutateAsync(obraFinalizar.id);
            toast.success(`Obra ${obraFinalizar.obra_id} cerrada`);
            setObraFinalizar(null);
          } catch (e: any) {
            toast.error("Error: " + e.message);
          }
        }}
      />
      <ConfirmDialog
        open={!!obraEliminar}
        onOpenChange={(o) => !o && setObraEliminar(null)}
        title={`¿Eliminar obra ${obraEliminar?.obra_id}?`}
        description="Esta acción no se puede deshacer. Se eliminarán también las solicitudes y movimientos asociados."
        confirmText="Eliminar"
        variant="destructive"
        loading={eliminarObra.isPending}
        onConfirm={handleEliminar}
      />
    </div>
  );
}

function StatCard({ label, value, variant = "default" }: { label: string; value: number; variant?: "default" | "success" | "warning" | "muted" }) {
  const colors = {
    default: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    muted: "text-muted-foreground",
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
        <div className={cn("text-3xl font-bold mt-1", colors[variant])}>{value}</div>
      </CardContent>
    </Card>
  );
}

function ObraCard({
  obra, puedeEditar, puedeEliminar, puedeCerrar,
  onVer, onEditar, onEliminar, onIniciar, onParaCierre, onFinalizar,
}: {
  obra: ObraConRelaciones;
  puedeEditar: boolean;
  puedeEliminar: boolean;
  puedeCerrar: boolean;
  onVer: (o: ObraConRelaciones) => void;
  onEditar: (o: ObraConRelaciones) => void;
  onEliminar: (o: ObraConRelaciones) => void;
  onIniciar: (o: ObraConRelaciones) => void;
  onParaCierre: (o: ObraConRelaciones) => void;
  onFinalizar: (o: ObraConRelaciones) => void;
}) {
  return (
    <Card className="hover:border-primary/40 transition-colors">
      <CardContent className="p-4 sm:p-5">
        {/* Layout: vertical en mobile, horizontal en desktop */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-4">
          {/* Info principal */}
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onVer(obra)}>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <h3 className="font-bold text-base sm:text-lg">{obra.obra_id}</h3>
              <span className={cn("px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold border whitespace-nowrap", estadoStyle(obra.estado))}>
                {obra.estado}
              </span>
            </div>

            <div className="text-sm font-medium break-words">
              {obra.cliente?.nombre ?? <span className="text-muted-foreground italic">— sin cliente —</span>}
              {obra.nombre_obra && <span className="text-muted-foreground"> · {obra.nombre_obra}</span>}
            </div>

            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
              {obra.sitio && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 flex-shrink-0" />
                  {obra.sitio}
                </span>
              )}
              {obra.fecha_inicio_est && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 flex-shrink-0" />
                  {formatDate(obra.fecha_inicio_est)}
                </span>
              )}
              {obra.jefe_obra && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3 flex-shrink-0" />
                  {obra.jefe_obra.nombre}
                </span>
              )}
              {obra.presupuesto > 0 && (
                <span className="font-medium text-foreground">
                  {formatCurrency(obra.presupuesto)}
                </span>
              )}
            </div>
          </div>

          {/* Acciones - en mobile como bottom bar */}
          <div className="flex gap-1 flex-wrap pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50 sm:flex-shrink-0">
            <Button variant="ghost" size="sm" onClick={() => onVer(obra)}>
              <Eye className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Ver</span>
            </Button>

            {/* Acciones de cambio de estado */}
            {puedeCerrar && obra.estado === "Pendiente OIO" && (
              <Button variant="ghost" size="sm" className="text-success" onClick={() => onIniciar(obra)}>
                <Play className="h-3.5 w-3.5" />
                Iniciar
              </Button>
            )}
            {puedeCerrar && obra.estado === "En ejecucion" && (
              <Button variant="ghost" size="sm" className="text-primary" onClick={() => onParaCierre(obra)}>
                <Lock className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Cerrar obra</span>
                <span className="sm:hidden">Cerrar</span>
              </Button>
            )}
            {puedeCerrar && obra.estado === "Para cierre" && (
              <Button variant="success" size="sm" onClick={() => onFinalizar(obra)}>
                <CheckCircle className="h-3.5 w-3.5" />
                Finalizar
              </Button>
            )}

            {puedeEditar && obra.estado !== "Cerrada" && (
              <Button variant="ghost" size="sm" onClick={() => onEditar(obra)}>
                <Edit className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Editar</span>
              </Button>
            )}
            {puedeEliminar && (
              <Button
                variant="ghost" size="icon"
                onClick={() => onEliminar(obra)}
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto sm:ml-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
