import { useState, useMemo } from "react";
import {
  Plus, Search, ShoppingCart, AlertCircle, Briefcase,
  CheckCircle, Clock, Package, X, FileDown, Eye,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCompras, useCambiarEstadoCompra } from "./useCompras";
import { CompraDialog } from "./CompraDialog";
import { CompraDetalle } from "./CompraDetalle";
import { RecibirCompraDialog } from "./RecibirCompraDialog";
import { ExportarOcDialog } from "./ExportarOcDialog";
import { PendientesOcTab } from "./PendientesOcTab";
import { useItemsPendientesOc } from "./useItemsPendientesOc";
import { useAuth } from "@/lib/auth";
import { puedeVerPreciosEnOC } from "@/lib/permissions";
import { cn, formatDate, formatCurrency } from "@/lib/utils";
import type { CompraConRelaciones, EstadoCompra } from "@/types/database";

const ESTADO_INFO: Record<EstadoCompra, { label: string; color: string; icon: any }> = {
  "Solicitada": { label: "Solicitada", color: "bg-warning/15 text-warning border-warning/30", icon: Clock },
  "Aprobada":   { label: "Aprobada", color: "bg-primary/15 text-primary border-primary/30", icon: CheckCircle },
  "Parcial":    { label: "Recibida parcial", color: "bg-primary/15 text-primary border-primary/30", icon: Package },
  "Recibida":   { label: "Recibida ✓", color: "bg-success/15 text-success border-success/30", icon: CheckCircle },
  "Rechazada":  { label: "Rechazada", color: "bg-destructive/15 text-destructive border-destructive/30", icon: X },
  "Cancelada":  { label: "Cancelada", color: "bg-muted text-muted-foreground", icon: X },
};

export default function ComprasPage() {
  const { profile } = useAuth();
  const { data: compras = [], isLoading, error } = useCompras();
  const cambiarEstado = useCambiarEstadoCompra();

  const [search, setSearch] = useState("");
  const [filtro, setFiltro] = useState<string>("activas");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [recibirOC, setRecibirOC] = useState<CompraConRelaciones | null>(null);
  const [exportarOC, setExportarOC] = useState<CompraConRelaciones | null>(null);
  const [verCompra, setVerCompra] = useState<CompraConRelaciones | null>(null);
  const [tab, setTab] = useState<"ocs" | "pendientes">("ocs");

  const { data: pendientes = [] } = useItemsPendientesOc();

  const puedeAprobar = profile && ["Direccion", "Operaciones"].includes(profile.area);
  const puedeRecibir = profile && ["Direccion", "Operaciones", "Contabilidad", "Paniol"].includes(profile.area);
  const verPrecios = puedeVerPreciosEnOC(profile?.area);

  const filtered = useMemo(() => {
    return compras.filter(c => {
      if (filtro === "activas" && (c.estado === "Recibida" || c.estado === "Cancelada" || c.estado === "Rechazada")) return false;
      if (filtro !== "activas" && filtro !== "todos" && c.estado !== filtro) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          c.compra_id.toLowerCase().includes(q) ||
          (c.proveedor?.nombre.toLowerCase().includes(q) ?? false) ||
          (c.obra?.obra_id?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [compras, search, filtro]);

  const stats = useMemo(() => ({
    pendientes: compras.filter(c => c.estado === "Solicitada").length,
    aprobadas: compras.filter(c => c.estado === "Aprobada" || c.estado === "Parcial").length,
    valorAbierto: compras
      .filter(c => ["Solicitada", "Aprobada", "Parcial"].includes(c.estado))
      .reduce((s, c) => s + (c.total_estimado ?? 0), 0),
    recibidas: compras.filter(c => c.estado === "Recibida").length,
  }), [compras]);

  const handleAprobar = async (c: CompraConRelaciones) => {
    try {
      await cambiarEstado.mutateAsync({ id: c.id, estado: "Aprobada" });
      toast.success(`OC ${c.compra_id} aprobada`);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  const handleCancelar = async (c: CompraConRelaciones) => {
    try {
      await cambiarEstado.mutateAsync({ id: c.id, estado: "Cancelada" });
      toast.success(`OC ${c.compra_id} cancelada`);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
            <ShoppingCart className="h-8 w-8 text-primary" />
            Compras
          </h1>
          <p className="text-muted-foreground mt-1">Órdenes de compra</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="lg">
          <Plus className="h-4 w-4" /> Nueva OC
        </Button>
      </div>

      <div className={cn("grid grid-cols-2 gap-4", verPrecios ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
        <StatCard label="Solicitadas" value={String(stats.pendientes)} variant="warning" />
        <StatCard label="En curso" value={String(stats.aprobadas)} variant="primary" />
        {verPrecios && (
          <StatCard label="Valor abierto" value={formatCurrency(stats.valorAbierto)} variant="default" small />
        )}
        <StatCard label="Recibidas" value={String(stats.recibidas)} variant="success" />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "ocs" | "pendientes")} className="w-full">
        <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 pb-1">
          <TabsList className="w-max">
            <TabsTrigger value="ocs">
              Órdenes de compra
              {compras.length > 0 && (
                <span className="ml-2 text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                  {compras.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="pendientes">
              Pendientes de OC
              {pendientes.length > 0 && (
                <span className="ml-2 text-[10px] bg-warning/20 text-warning border border-warning/30 px-1.5 py-0.5 rounded-full font-bold">
                  {pendientes.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="ocs" className="space-y-4 mt-4">
          <div className="flex gap-3 flex-wrap items-center">
            <div className="flex-1 min-w-[280px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por OC, proveedor, obra..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filtro} onValueChange={setFiltro}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="activas">Activas</SelectItem>
                <SelectItem value="todos">Todas</SelectItem>
                <SelectItem value="Solicitada">Solicitadas</SelectItem>
                <SelectItem value="Aprobada">Aprobadas</SelectItem>
                <SelectItem value="Parcial">Parciales</SelectItem>
                <SelectItem value="Recibida">Recibidas</SelectItem>
                <SelectItem value="Cancelada">Canceladas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <Card><CardContent className="py-16 text-center text-muted-foreground">Cargando OCs...</CardContent></Card>
          ) : error ? (
            <Card className="border-destructive">
              <CardContent className="py-8 flex items-center gap-3 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <div className="text-sm">{(error as Error).message}</div>
              </CardContent>
            </Card>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground">Sin órdenes de compra</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filtered.map(c => (
                <CompraCard
                  key={c.id}
                  compra={c}
                  puedeAprobar={!!puedeAprobar}
                  puedeRecibir={!!puedeRecibir}
                  verPrecios={verPrecios}
                  onAprobar={() => handleAprobar(c)}
                  onRecibir={() => setRecibirOC(c)}
                  onExportar={() => setExportarOC(c)}
                  onVer={() => setVerCompra(c)}
                  onCancelar={() => handleCancelar(c)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pendientes" className="mt-4">
          <PendientesOcTab />
        </TabsContent>
      </Tabs>

      <CompraDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      <RecibirCompraDialog
        open={!!recibirOC}
        onOpenChange={(o) => !o && setRecibirOC(null)}
        compra={recibirOC}
      />
      <ExportarOcDialog
        open={!!exportarOC}
        onOpenChange={(o) => !o && setExportarOC(null)}
        compra={exportarOC}
      />
      <CompraDetalle
        open={!!verCompra}
        onOpenChange={(o) => !o && setVerCompra(null)}
        compra={verCompra}
        onExportar={() => {
          if (verCompra) {
            setExportarOC(verCompra);
            setVerCompra(null);
          }
        }}
      />
    </div>
  );
}

function StatCard({
  label, value, variant = "default", small,
}: {
  label: string; value: string;
  variant?: "default" | "primary" | "warning" | "success" | "destructive";
  small?: boolean;
}) {
  const colors = {
    default: "text-foreground", primary: "text-primary", warning: "text-warning",
    success: "text-success", destructive: "text-destructive",
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
        <div className={cn(small ? "text-xl" : "text-3xl", "font-bold mt-1", colors[variant])}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function CompraCard({
  compra, puedeAprobar, puedeRecibir, verPrecios, onAprobar, onRecibir, onExportar, onVer, onCancelar,
}: {
  compra: CompraConRelaciones;
  puedeAprobar: boolean;
  puedeRecibir: boolean;
  verPrecios: boolean;
  onAprobar: () => void;
  onRecibir: () => void;
  onExportar: () => void;
  onVer: () => void;
  onCancelar: () => void;
}) {
  const info = ESTADO_INFO[compra.estado];
  const Icon = info.icon;
  const totalItems = compra.items?.length ?? 0;
  const recibidos = compra.items?.filter(it => it.cantidad_recibida >= it.cantidad_solicitada).length ?? 0;
  const cantSol = compra.items?.reduce((s, it) => s + it.cantidad_solicitada, 0) ?? 0;
  const cantRec = compra.items?.reduce((s, it) => s + it.cantidad_recibida, 0) ?? 0;
  const pct = cantSol > 0 ? (cantRec / cantSol) * 100 : 0;

  return (
    <Card className="hover:border-primary/40 transition-colors">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-bold">{compra.compra_id}</span>
              <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1", info.color)}>
                <Icon className="h-3 w-3" /> {info.label}
              </span>
            </div>

            <div className="text-sm">
              <b>{compra.proveedor?.nombre ?? "Sin proveedor"}</b>
            </div>

            <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
              {compra.obra && (
                <span className="flex items-center gap-1">
                  <Briefcase className="h-3 w-3" /> {compra.obra.obra_id}
                </span>
              )}
              <span>📅 {formatDate(compra.fecha_solicitud)}</span>
              <span>{totalItems} {totalItems === 1 ? "ítem" : "ítems"} ({recibidos} completos)</span>
            </div>

            {verPrecios && compra.total_estimado && (
              <div className="text-sm font-semibold mt-1">
                {formatCurrency(compra.total_estimado, (compra.moneda ?? "ARS") as "ARS" | "USD")}
                {compra.moneda === "USD" && <span className="text-[10px] text-muted-foreground ml-1">USD</span>}
              </div>
            )}

            {(compra.estado === "Aprobada" || compra.estado === "Parcial") && cantSol > 0 && (
              <div className="mt-2">
                <div className="h-1 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-success" style={{ width: `${pct}%` }} />
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {cantRec} de {cantSol} unidades recibidas ({Math.round(pct)}%)
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-1 flex-wrap pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50 sm:flex-shrink-0">
            <Button size="sm" variant="ghost" onClick={onVer} title="Ver detalle">
              <Eye className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Ver</span>
            </Button>
            <Button size="sm" variant="ghost" onClick={onExportar} title="Exportar PDF">
              <FileDown className="h-3.5 w-3.5" /> PDF
            </Button>
            {compra.estado === "Solicitada" && puedeAprobar && (
              <Button size="sm" variant="success" onClick={onAprobar}>
                <CheckCircle className="h-3.5 w-3.5" /> Aprobar
              </Button>
            )}
            {(compra.estado === "Aprobada" || compra.estado === "Parcial") && puedeRecibir && (
              <Button size="sm" variant="default" onClick={onRecibir}>
                <Package className="h-3.5 w-3.5" /> Recibir
              </Button>
            )}
            {(compra.estado === "Solicitada" || compra.estado === "Aprobada") && puedeAprobar && (
              <Button size="sm" variant="ghost" onClick={onCancelar} className="text-destructive">
                Cancelar
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
