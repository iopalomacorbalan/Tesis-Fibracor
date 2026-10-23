import { useState, useMemo } from "react";
import {
  Search, GitBranch, AlertCircle, ArrowDown, ArrowUp, ArrowLeftRight,
  Wrench, Trash, RotateCcw, CheckCircle, Clock, X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  useMovimientos, useDevolucionesPendientes, useCancelarDevolucionPendiente,
} from "./useMovimientos";
import { AceptarDevolucionDialog } from "./AceptarDevolucionDialog";
import { useAuth } from "@/lib/auth";
import { cn, formatDate } from "@/lib/utils";
import type { MovimientoConRelaciones, TipoMovimiento } from "@/types/database";

const TIPO_INFO: Record<TipoMovimiento, { label: string; color: string; icon: any; sign: string }> = {
  "Ingreso_compra":      { label: "Ingreso compra", color: "text-success", icon: ArrowUp, sign: "+" },
  "Ingreso_inicial":     { label: "Stock inicial", color: "text-success", icon: ArrowUp, sign: "+" },
  "Ajuste_positivo":     { label: "Ajuste +", color: "text-success", icon: ArrowUp, sign: "+" },
  "Ajuste_negativo":     { label: "Ajuste -", color: "text-destructive", icon: ArrowDown, sign: "-" },
  "Retiro":              { label: "Retiro", color: "text-primary", icon: ArrowDown, sign: "-" },
  "Devolucion_pendiente":{ label: "Devolución pendiente", color: "text-warning", icon: Clock, sign: "..." },
  "Devolucion":          { label: "Devolución aceptada", color: "text-success", icon: CheckCircle, sign: "+" },
  "Reactivacion":        { label: "Reactivación", color: "text-success", icon: RotateCcw, sign: "+" },
  "Baja":                { label: "Baja", color: "text-destructive", icon: Trash, sign: "-" },
  "Transferencia":       { label: "Transferencia", color: "text-primary", icon: ArrowLeftRight, sign: "=" },
  "Asignacion_personal":  { label: "Asignación personal", color: "text-primary", icon: Wrench, sign: "-" },
  "Devolucion_personal_pendiente": { label: "Devolución personal pendiente", color: "text-warning", icon: Clock, sign: "..." },
  "Devolucion_personal": { label: "Devolución personal", color: "text-success", icon: CheckCircle, sign: "+" },
};

export default function MovimientosPage() {
  const { profile } = useAuth();
  const { data: movimientos = [], isLoading } = useMovimientos();
  const { data: pendientes = [] } = useDevolucionesPendientes();
  const cancelarPendiente = useCancelarDevolucionPendiente();

  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [movAceptar, setMovAceptar] = useState<MovimientoConRelaciones | null>(null);
  const [movCancelar, setMovCancelar] = useState<MovimientoConRelaciones | null>(null);

  const esPaniol = profile && ["Direccion", "Operaciones", "Contabilidad", "Paniol"].includes(profile.area);

  const filtered = useMemo(() => {
    return movimientos.filter(m => {
      if (filtroTipo !== "todos" && m.tipo !== filtroTipo) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          m.mov_id.toLowerCase().includes(s) ||
          ((m as any).item?.descripcion?.toLowerCase().includes(s) ?? false) ||
          ((m as any).obra?.obra_id?.toLowerCase().includes(s) ?? false) ||
          ((m as any).tecnico?.nombre?.toLowerCase().includes(s) ?? false)
        );
      }
      return true;
    });
  }, [movimientos, search, filtroTipo]);

  const handleCancelarPendiente = async () => {
    if (!movCancelar) return;
    try {
      await cancelarPendiente.mutateAsync(movCancelar.id);
      toast.success("Devolución pendiente cancelada");
      setMovCancelar(null);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
          <GitBranch className="h-8 w-8 text-primary" />
          Movimientos
        </h1>
        <p className="text-muted-foreground mt-1">
          Historial completo y devoluciones pendientes
        </p>
      </div>

      <Tabs defaultValue={pendientes.length > 0 && esPaniol ? "pendientes" : "todos"}>
        <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 pb-1"><TabsList className="w-max">
          <TabsTrigger value="todos">📋 Historial completo</TabsTrigger>
          <TabsTrigger value="pendientes">
            ⏳ Devoluciones pendientes
            {pendientes.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-warning text-warning-foreground text-[10px] font-bold">
                {pendientes.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList></div>

        <TabsContent value="todos">
          <div className="space-y-4">
            <div className="flex gap-3 flex-wrap items-center">
              <div className="flex-1 min-w-[280px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por ID, ítem, obra, técnico..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los tipos</SelectItem>
                  {Object.entries(TIPO_INFO).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-sm text-muted-foreground">
                {filtered.length} mov.
              </div>
            </div>

            {isLoading ? (
              <Card><CardContent className="py-16 text-center text-muted-foreground">Cargando...</CardContent></Card>
            ) : filtered.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <GitBranch className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground">Sin movimientos</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {filtered.map(m => <MovCard key={m.id} mov={m} />)}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="pendientes">
          {!esPaniol ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Solo Pañol/Operaciones/Dirección pueden procesar devoluciones
              </CardContent>
            </Card>
          ) : pendientes.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-success/40 mb-3" />
                <p className="text-muted-foreground">No hay devoluciones pendientes</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {pendientes.map(m => (
                <PendienteCard
                  key={m.id}
                  mov={m}
                  onAceptar={() => setMovAceptar(m)}
                  onCancelar={() => setMovCancelar(m)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AceptarDevolucionDialog
        open={!!movAceptar}
        onOpenChange={(o) => !o && setMovAceptar(null)}
        movimiento={movAceptar}
      />
      <ConfirmDialog
        open={!!movCancelar}
        onOpenChange={(o) => !o && setMovCancelar(null)}
        title="¿Cancelar devolución pendiente?"
        description="Se elimina el pedido de devolución. La cantidad sigue figurando como en obra."
        confirmText="Sí, cancelar"
        variant="destructive"
        loading={cancelarPendiente.isPending}
        onConfirm={handleCancelarPendiente}
      />
    </div>
  );
}

function MovCard({ mov }: { mov: MovimientoConRelaciones }) {
  const info = TIPO_INFO[mov.tipo as TipoMovimiento] ?? { label: mov.tipo, color: "", icon: ArrowLeftRight, sign: "=" };
  const Icon = info.icon;
  const item = (mov as any).item;
  const obra = (mov as any).obra;
  const tecnico = (mov as any).tecnico;
  const ejecutor = (mov as any).ejecutor;

  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div className={`h-9 w-9 rounded-md flex items-center justify-center bg-secondary ${info.color} flex-shrink-0`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <div className="text-sm">
                <b>{info.label}</b>
                <span className="text-xs text-muted-foreground"> · {mov.mov_id}</span>
              </div>
              <div className={`font-bold text-sm ${info.color}`}>
                {info.sign}{mov.cantidad} {item?.unidad ?? ""}
              </div>
            </div>
            <div className="text-xs mt-0.5">
              {item ? (
                <span className="font-medium">{item.descripcion}</span>
              ) : (
                <span className="text-muted-foreground italic">(sin ítem)</span>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
              <span>{formatDate(mov.fecha)}</span>
              {obra && <span>· 🏗 {obra.obra_id}</span>}
              {tecnico && <span>· 👤 {tecnico.nombre}</span>}
              {ejecutor && <span>· ✓ {ejecutor.nombre}</span>}
            </div>
            {mov.observaciones && (
              <div className="text-xs text-muted-foreground italic mt-1">"{mov.observaciones}"</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PendienteCard({
  mov, onAceptar, onCancelar,
}: {
  mov: MovimientoConRelaciones;
  onAceptar: () => void;
  onCancelar: () => void;
}) {
  const item = (mov as any).item;
  const obra = (mov as any).obra;
  const tecnico = (mov as any).tecnico;

  return (
    <Card className="border-warning/40 bg-warning/5">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="h-10 w-10 rounded-md bg-warning/20 text-warning flex items-center justify-center flex-shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <b className="text-sm">{item?.descripcion ?? "Sin ítem"}</b>
                <span className="text-xs text-muted-foreground">{mov.mov_id}</span>
              </div>
              <div className="text-sm">
                <b className="text-warning">{mov.cantidad} {item?.unidad ?? ""}</b>
                {tecnico && <> · 👤 {tecnico.nombre}</>}
                {obra && <> · 🏗 {obra.obra_id}</>}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Solicitada el {formatDate(mov.fecha)}
                {mov.estado_herramienta && <> · Estado declarado: <b>{mov.estado_herramienta}</b></>}
              </div>
              {mov.observaciones && (
                <div className="text-xs text-muted-foreground italic mt-1">"{mov.observaciones}"</div>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button variant="success" size="sm" onClick={onAceptar}>
              <CheckCircle className="h-3.5 w-3.5" /> Aceptar
            </Button>
            <Button variant="ghost" size="sm" onClick={onCancelar} className="text-destructive">
              <X className="h-3.5 w-3.5" /> Cancelar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
