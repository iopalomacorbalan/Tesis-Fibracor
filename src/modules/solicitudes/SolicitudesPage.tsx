import { useState, useMemo } from "react";
import {
  Plus, Search, ClipboardList, AlertCircle, Briefcase, User,
  AlertTriangle, Clock, CheckCircle, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useSolicitudes, useCancelarSolicitud } from "./useSolicitudes";
import { SolicitudDialog } from "./SolicitudDialog";
import { SolicitudDetalle } from "./SolicitudDetalle";
import { useAuth } from "@/lib/auth";
import { cn, formatDate } from "@/lib/utils";
import type { SolicitudConRelaciones, EstadoSolicitud, PrioridadSol } from "@/types/database";

const ESTADO_INFO: Record<EstadoSolicitud, { label: string; color: string; icon: any }> = {
  "Pendiente":  { label: "Pendiente", color: "bg-warning/15 text-warning border-warning/30", icon: Clock },
  "Parcial":    { label: "Parcial", color: "bg-primary/15 text-primary border-primary/30", icon: ClipboardList },
  "Atendida":   { label: "Atendida", color: "bg-success/15 text-success border-success/30", icon: CheckCircle },
  "Cancelada":  { label: "Cancelada", color: "bg-destructive/15 text-destructive border-destructive/30", icon: XCircle },
};

const PRIORIDAD_COLOR: Record<PrioridadSol, string> = {
  "Normal": "bg-muted text-muted-foreground",
  "Alta": "bg-warning/15 text-warning border-warning/30",
  "Urgente": "bg-destructive/15 text-destructive border-destructive/30",
};

export default function SolicitudesPage() {
  const { profile } = useAuth();
  const { data: solicitudes = [], isLoading, error } = useSolicitudes();
  const cancelar = useCancelarSolicitud();

  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("activas");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [solDetalle, setSolDetalle] = useState<SolicitudConRelaciones | null>(null);
  const [solCancelar, setSolCancelar] = useState<SolicitudConRelaciones | null>(null);

  const esTecnico = profile?.area === "Tecnico";
  const esResponsable = profile && ["Direccion", "Operaciones", "Paniol"].includes(profile.area);

  const filtered = useMemo(() => {
    return solicitudes.filter(s => {
      if (filtroEstado === "activas" && (s.estado === "Atendida" || s.estado === "Cancelada")) return false;
      if (filtroEstado !== "todos" && filtroEstado !== "activas" && s.estado !== filtroEstado) return false;
      // Si es técnico, mostrar solo las suyas
      if (esTecnico && profile && s.tecnico_id !== profile.id) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          s.solicitud_id.toLowerCase().includes(q) ||
          (s.obra?.obra_id?.toLowerCase().includes(q) ?? false) ||
          (s.tecnico?.nombre?.toLowerCase().includes(q) ?? false) ||
          (s.observaciones?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [solicitudes, search, filtroEstado, esTecnico, profile]);

  const stats = useMemo(() => ({
    pendientes: solicitudes.filter(s => s.estado === "Pendiente").length,
    parciales: solicitudes.filter(s => s.estado === "Parcial").length,
    urgentes: solicitudes.filter(s =>
      s.prioridad === "Urgente" && (s.estado === "Pendiente" || s.estado === "Parcial")
    ).length,
    atendidas: solicitudes.filter(s => s.estado === "Atendida").length,
  }), [solicitudes]);

  const handleCancelar = async () => {
    if (!solCancelar) return;
    try {
      await cancelar.mutateAsync(solCancelar.id);
      toast.success(`Solicitud ${solCancelar.solicitud_id} cancelada`);
      setSolCancelar(null);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
            <ClipboardList className="h-8 w-8 text-primary" />
            Solicitudes
          </h1>
          <p className="text-muted-foreground mt-1">
            {esTecnico ? "Tus pedidos de materiales y herramientas" : "Pedidos de los técnicos"}
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="lg">
          <Plus className="h-4 w-4" />
          Nueva solicitud
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Pendientes" value={stats.pendientes} variant="warning" />
        <StatCard label="Parciales" value={stats.parciales} variant="primary" />
        <StatCard label="Urgentes" value={stats.urgentes} variant={stats.urgentes > 0 ? "destructive" : "muted"} />
        <StatCard label="Atendidas" value={stats.atendidas} variant="success" />
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex-1 min-w-[280px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por ID, obra, técnico..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="activas">Activas</SelectItem>
            <SelectItem value="todos">Todas</SelectItem>
            <SelectItem value="Pendiente">Pendientes</SelectItem>
            <SelectItem value="Parcial">Parciales</SelectItem>
            <SelectItem value="Atendida">Atendidas</SelectItem>
            <SelectItem value="Cancelada">Canceladas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">Cargando...</CardContent></Card>
      ) : error ? (
        <Card className="border-destructive">
          <CardContent className="py-8 flex items-center gap-3 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <div>
              <div className="font-semibold">Error al cargar solicitudes</div>
              <div className="text-sm">{(error as Error).message}</div>
            </div>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">Sin solicitudes</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => (
            <SolicitudCard
              key={s.id}
              solicitud={s}
              onClick={() => setSolDetalle(s)}
              onCancelar={() => setSolCancelar(s)}
              puedeCancelar={!!esResponsable || (esTecnico && s.tecnico_id === profile?.id)}
            />
          ))}
        </div>
      )}

      <SolicitudDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      <SolicitudDetalle
        open={!!solDetalle}
        onOpenChange={(o) => !o && setSolDetalle(null)}
        solicitud={solDetalle}
      />
      <ConfirmDialog
        open={!!solCancelar}
        onOpenChange={(o) => !o && setSolCancelar(null)}
        title={`¿Cancelar solicitud ${solCancelar?.solicitud_id}?`}
        description="Se marca como cancelada y todos sus ítems pendientes también."
        confirmText="Cancelar solicitud"
        variant="destructive"
        loading={cancelar.isPending}
        onConfirm={handleCancelar}
      />
    </div>
  );
}

function StatCard({ label, value, variant = "default" }: {
  label: string; value: number;
  variant?: "default" | "primary" | "warning" | "success" | "destructive" | "muted";
}) {
  const colors = {
    default: "text-foreground", primary: "text-primary", warning: "text-warning",
    success: "text-success", destructive: "text-destructive", muted: "text-muted-foreground",
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

function SolicitudCard({
  solicitud, onClick, onCancelar, puedeCancelar,
}: {
  solicitud: SolicitudConRelaciones;
  onClick: () => void;
  onCancelar: () => void;
  puedeCancelar: boolean;
}) {
  const estadoInfo = ESTADO_INFO[solicitud.estado];
  const EstadoIcon = estadoInfo.icon;
  const totalItems = solicitud.items?.length ?? 0;
  const entregados = solicitud.items?.filter(i => i.estado === "entregado").length ?? 0;
  const esActiva = solicitud.estado === "Pendiente" || solicitud.estado === "Parcial";

  return (
    <Card
      className="hover:border-primary/40 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex justify-between items-start gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-bold">{solicitud.solicitud_id}</span>
              <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1", estadoInfo.color)}>
                <EstadoIcon className="h-3 w-3" /> {estadoInfo.label}
              </span>
              {solicitud.prioridad !== "Normal" && (
                <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border", PRIORIDAD_COLOR[solicitud.prioridad])}>
                  {solicitud.prioridad === "Urgente" && <AlertTriangle className="inline h-3 w-3 mr-0.5" />}
                  {solicitud.prioridad}
                </span>
              )}
            </div>

            <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
              {solicitud.obra && (
                <span className="flex items-center gap-1">
                  <Briefcase className="h-3 w-3" /> {solicitud.obra.obra_id}
                  {solicitud.obra.nombre_obra && ` — ${solicitud.obra.nombre_obra}`}
                </span>
              )}
              {solicitud.tecnico && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" /> {solicitud.tecnico.nombre}
                </span>
              )}
              <span>{formatDate(solicitud.fecha_solicitud)}</span>
            </div>

            <div className="text-sm mt-2">
              <b>{totalItems}</b> {totalItems === 1 ? "ítem" : "ítems"}
              {entregados > 0 && entregados < totalItems && (
                <span className="text-success"> · {entregados} entregados</span>
              )}
            </div>

            {solicitud.observaciones && (
              <div className="text-xs text-muted-foreground italic mt-1 truncate">
                "{solicitud.observaciones}"
              </div>
            )}
          </div>

          {esActiva && puedeCancelar && (
            <Button
              variant="ghost" size="sm"
              onClick={(e) => { e.stopPropagation(); onCancelar(); }}
              className="text-destructive"
            >
              Cancelar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
