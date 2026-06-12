import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Briefcase, Package, ClipboardList, ShoppingCart, FileText,
  AlertTriangle, Clock, GitBranch, Wrench, TrendingUp, Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useObras } from "@/modules/obras/useObras";
import { useInventario, useItemsFueraServicio } from "@/modules/stock/useInventario";
import { useSolicitudes } from "@/modules/solicitudes/useSolicitudes";
import { useDevolucionesPendientes } from "@/modules/movimientos/useMovimientos";
import { useCompras } from "@/modules/compras/useCompras";
import { useReportes } from "@/modules/reportes/useReportes";
import { useClientes } from "@/modules/crm/clientes/useClientes";
import { usePrecioHoraTecnica, useActualizarPrecioHora } from "./useConfigGlobal";
import { useAuth } from "@/lib/auth";
import { puedeVerPrecios as canViewPrices } from "@/lib/permissions";
import { cn, formatDate, formatCurrency } from "@/lib/utils";

export default function DashboardPage() {
  const { profile } = useAuth();
  const puedeVerPrecios = canViewPrices(profile?.area);
  const { data: obras = [] } = useObras();
  const { data: items = [] } = useInventario();
  const { data: itemsFS = [] } = useItemsFueraServicio();
  const { data: solicitudes = [] } = useSolicitudes();
  const { data: pendientes = [] } = useDevolucionesPendientes();
  const { data: compras = [] } = useCompras();
  const { data: reportes = [] } = useReportes();
  const { data: clientes = [] } = useClientes();

  const obrasActivas = obras.filter(o => o.estado === "En ejecucion");
  const obrasPendientes = obras.filter(o => o.estado === "Pendiente OIO");
  const itemsCriticos = items.filter(i => i.stock_minimo > 0 && i.stock_disponible <= i.stock_minimo);
  const solicitudesActivas = solicitudes.filter(s => s.estado === "Pendiente" || s.estado === "Parcial");
  const solicitudesUrgentes = solicitudesActivas.filter(s => s.prioridad === "Urgente");
  const ocAbiertas = compras.filter(c => ["Solicitada", "Aprobada", "Parcial"].includes(c.estado));
  const valorOC = ocAbiertas.reduce((s, c) => s + (c.total_estimado ?? 0), 0);
  const valorInventario = items.reduce((s, i) => s + i.stock_disponible * i.precio_costo, 0);

  const reportesUlt7 = reportes.filter(r => {
    const dt = new Date(r.fecha).getTime();
    return Date.now() - dt < 7 * 24 * 3600 * 1000;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          ¡Hola, {profile?.nombre?.split(" ")[0]}! 👋
        </h1>
        <p className="text-muted-foreground mt-1">
          Resumen general · {new Date().toLocaleDateString("es-AR", {
            weekday: "long", day: "numeric", month: "long", year: "numeric",
          })}
        </p>
      </div>

      {/* Alertas críticas arriba */}
      {(itemsCriticos.length > 0 || pendientes.length > 0 || solicitudesUrgentes.length > 0 || itemsFS.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {solicitudesUrgentes.length > 0 && (
            <AlertCard
              to="/solicitudes"
              icon={<AlertTriangle className="h-5 w-5" />}
              title="Solicitudes urgentes"
              count={solicitudesUrgentes.length}
              variant="destructive"
            />
          )}
          {itemsCriticos.length > 0 && (
            <AlertCard
              to="/stock"
              icon={<AlertTriangle className="h-5 w-5" />}
              title="Stock crítico"
              count={itemsCriticos.length}
              variant="destructive"
            />
          )}
          {pendientes.length > 0 && (
            <AlertCard
              to="/movimientos"
              icon={<Clock className="h-5 w-5" />}
              title="Devoluciones pendientes"
              count={pendientes.length}
              variant="warning"
            />
          )}
          {itemsFS.length > 0 && (
            <AlertCard
              to="/stock"
              icon={<Wrench className="h-5 w-5" />}
              title="En revisión / FS"
              count={itemsFS.length}
              variant="warning"
            />
          )}
        </div>
      )}

      {/* KPIs principales */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard to="/obras" icon={Briefcase} label="Obras activas"
          value={obrasActivas.length} sublabel={`${obrasPendientes.length} pendientes`} />
        <KpiCard to="/stock" icon={Package} label="Ítems en stock"
          value={items.length} sublabel={`${itemsCriticos.length} críticos`} />
        <KpiCard to="/solicitudes" icon={ClipboardList} label="Solicitudes"
          value={solicitudesActivas.length} sublabel="activas" />
        <KpiCard to="/compras" icon={ShoppingCart} label="OCs abiertas"
          value={ocAbiertas.length} sublabel={puedeVerPrecios ? formatCurrency(valorOC) : undefined} />
        <KpiCard to="/reportes" icon={FileText} label="Reportes 7d"
          value={reportesUlt7.length} sublabel={`${reportes.length} totales`} />
        <KpiCard to="/crm" icon={Users} label="Clientes"
          value={clientes.length} sublabel="activos" />
      </div>

      {/* Resumen de inventario - solo Direccion/Operaciones/Contabilidad */}
      {puedeVerPrecios && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Valor de inventario
              </h2>
            </div>
            <div className="text-3xl font-bold">{formatCurrency(valorInventario)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Calculado sobre stock disponible × precio costo
            </p>
          </CardContent>
        </Card>
      )}

      {/* Precio hora técnica - solo Dirección */}
      {!!profile && ["Direccion", "Operaciones", "Contabilidad"].includes(profile.area) && <PrecioHoraCard />}

      {/* Dos columnas con últimas obras y reportes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" />
                Obras en ejecución
              </h2>
              <Link to="/obras" className="text-xs text-primary hover:underline">Ver todas</Link>
            </div>
            {obrasActivas.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">No hay obras activas</div>
            ) : (
              <div className="space-y-2">
                {obrasActivas.slice(0, 5).map(o => (
                  <Link
                    key={o.id}
                    to="/obras"
                    className="block rounded-md border p-2 hover:bg-accent transition-colors"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{o.obra_id}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {o.cliente?.nombre ?? "Sin cliente"}
                          {o.nombre_obra && ` — ${o.nombre_obra}`}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Últimos reportes
              </h2>
              <Link to="/reportes" className="text-xs text-primary hover:underline">Ver todos</Link>
            </div>
            {reportes.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">Sin reportes</div>
            ) : (
              <div className="space-y-2">
                {reportes.slice(0, 5).map(r => (
                  <Link
                    key={r.id}
                    to="/reportes"
                    className="block rounded-md border p-2 hover:bg-accent transition-colors"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium break-words">
                          {r.reporte_id}
                          {r.obra?.obra_id && <span className="text-muted-foreground"> · {r.obra.obra_id}</span>}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {r.tecnico?.nombre} · {formatDate(r.fecha)}
                        </div>
                      </div>
                      {(r.fotos?.length ?? 0) > 0 && (
                        <span className="text-xs text-primary flex-shrink-0">📷 {r.fotos!.length}</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  to, icon: Icon, label, value, sublabel,
}: {
  to: string;
  icon: any;
  label: string;
  value: number | string;
  sublabel?: string;
}) {
  return (
    <Link to={to}>
      <Card className="hover:border-primary/40 hover:bg-accent/50 transition-colors h-full">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Icon className="h-4 w-4" />
            <span className="text-[11px] uppercase tracking-wider">{label}</span>
          </div>
          <div className="text-2xl font-bold">{value}</div>
          {sublabel && <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{sublabel}</div>}
        </CardContent>
      </Card>
    </Link>
  );
}

function AlertCard({
  to, icon, title, count, variant,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  count: number;
  variant: "warning" | "destructive";
}) {
  const colors = {
    warning: "border-warning/40 bg-warning/5 text-warning",
    destructive: "border-destructive/40 bg-destructive/5 text-destructive",
  };
  return (
    <Link to={to}>
      <Card className={cn("hover:scale-[1.02] transition-transform", colors[variant])}>
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            {icon}
            <div className="flex-1">
              <div className="text-xs font-medium">{title}</div>
              <div className="text-2xl font-bold">{count}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function PrecioHoraCard() {
  const { data: config, isLoading } = usePrecioHoraTecnica();
  const actualizar = useActualizarPrecioHora();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");

  const handleEditar = () => {
    setVal(String(config?.amount ?? 0));
    setEditing(true);
  };

  const handleGuardar = async () => {
    const num = parseFloat(val);
    if (isNaN(num) || num < 0) {
      toast.error("Ingresá un número válido");
      return;
    }
    try {
      await actualizar.mutateAsync(num);
      toast.success("Precio actualizado");
      setEditing(false);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Precio hora técnica
          </h2>
        </div>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Cargando...</div>
        ) : editing ? (
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              className="flex-1 h-12 px-3 text-2xl font-bold border rounded-md bg-background"
              autoFocus
            />
            <Button size="sm" onClick={handleGuardar} disabled={actualizar.isPending}>
              {actualizar.isPending ? "..." : "Guardar"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold">{formatCurrency(config?.amount ?? 0)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Se aplica al calcular el costo de horas técnicas de cada obra
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={handleEditar}>
              Editar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
