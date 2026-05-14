import { useState, useMemo } from "react";
import {
  Plus, Search, Edit, Trash2, Settings, Wrench, AlertTriangle, AlertCircle,
  Package, CheckCircle, Trash, History,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  useInventario, useEliminarItem, useItemsFueraServicio,
} from "./useInventario";
import { ItemDialog } from "./ItemDialog";
import { AjusteDialog } from "./AjusteDialog";
import { ReactivarDialog } from "./ReactivarDialog";
import { HistorialDialog } from "./HistorialDialog";
import { useAuth } from "@/lib/auth";
import { puedeVerPrecios as canViewPrices } from "@/lib/permissions";
import { cn, formatCurrency } from "@/lib/utils";
import type { Inventario, CategoriaItem } from "@/types/database";

const CATEGORIAS_FILTROS: (CategoriaItem | "Todos" | "Críticos")[] = [
  "Todos", "Críticos", "Material", "Consumo", "Herramienta", "Reutilizable", "Equipo especial",
];

const CATEGORIA_COLORS: Record<CategoriaItem, string> = {
  "Material": "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "Consumo": "bg-green-500/15 text-green-400 border-green-500/30",
  "Herramienta": "bg-purple-500/15 text-purple-400 border-purple-500/30",
  "Reutilizable": "bg-orange-500/15 text-orange-400 border-orange-500/30",
  "Equipo especial": "bg-pink-500/15 text-pink-400 border-pink-500/30",
};

export default function StockPage() {
  const { profile } = useAuth();
  const { data: items = [], isLoading, error } = useInventario();
  const { data: itemsFS = [] } = useItemsFueraServicio();
  const eliminar = useEliminarItem();

  const [search, setSearch] = useState("");
  const [filtro, setFiltro] = useState<string>("Todos");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [itemEditar, setItemEditar] = useState<Inventario | null>(null);
  const [itemEliminar, setItemEliminar] = useState<Inventario | null>(null);
  const [itemAjustar, setItemAjustar] = useState<Inventario | null>(null);
  const [itemReactivar, setItemReactivar] = useState<Inventario | null>(null);
  const [accionReactivar, setAccionReactivar] = useState<"reactivar" | "dar_de_baja">("reactivar");
  const [itemHistorial, setItemHistorial] = useState<Inventario | null>(null);

  const puedeEditar = profile && ["Direccion", "Operaciones", "Paniol"].includes(profile.area);
  const puedeVerPrecios = canViewPrices(profile?.area);

  const filtered = useMemo(() => {
    return items.filter(i => {
      if (filtro === "Críticos") {
        if (i.stock_minimo <= 0 || i.stock_disponible > i.stock_minimo) return false;
      } else if (filtro !== "Todos" && i.categoria !== filtro) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          i.descripcion.toLowerCase().includes(s) ||
          i.item_id.toLowerCase().includes(s) ||
          (i.numero_serie?.toLowerCase().includes(s) ?? false) ||
          (i.ubicacion_fisica?.toLowerCase().includes(s) ?? false)
        );
      }
      return true;
    });
  }, [items, search, filtro]);

  const stats = useMemo(() => {
    const total = items.length;
    const criticos = items.filter(i => i.stock_minimo > 0 && i.stock_disponible <= i.stock_minimo).length;
    const valorTotal = items.reduce((sum, i) => sum + (i.stock_disponible * i.precio_costo), 0);
    const fueraServicio = itemsFS.length;
    return { total, criticos, valorTotal, fueraServicio };
  }, [items, itemsFS]);

  const handleEliminar = async () => {
    if (!itemEliminar) return;
    try {
      await eliminar.mutateAsync(itemEliminar.id);
      toast.success(`Ítem ${itemEliminar.item_id} eliminado`);
      setItemEliminar(null);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  const totalFS = itemsFS.reduce((s, i) => s + i.stock_fuera_servicio, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
            <Package className="h-8 w-8 text-primary" />
            Stock
          </h1>
          <p className="text-muted-foreground mt-1">
            Inventario, materiales y herramientas
          </p>
        </div>
        {puedeEditar && (
          <Button onClick={() => { setItemEditar(null); setDialogOpen(true); }} size="lg">
            <Plus className="h-4 w-4" />
            Nuevo ítem
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className={cn(
        "grid grid-cols-2 gap-4",
        puedeVerPrecios ? "lg:grid-cols-4" : "lg:grid-cols-3"
      )}>
        <StatCard label="Total ítems" value={stats.total} icon={Package} />
        <StatCard
          label="Stock crítico" value={stats.criticos}
          icon={AlertTriangle} variant={stats.criticos > 0 ? "destructive" : "muted"}
        />
        <StatCard
          label="En revisión / FS" value={stats.fueraServicio}
          icon={Wrench} variant={stats.fueraServicio > 0 ? "warning" : "muted"}
        />
        {puedeVerPrecios && (
          <StatCard
            label="Valor total"
            value={formatCurrency(stats.valorTotal)}
            icon={() => <span className="text-muted-foreground">$</span>}
            textValue
          />
        )}
      </div>

      {/* Banner herramientas en revisión */}
      {itemsFS.length > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-warning/15 text-warning flex items-center justify-center">
                  <Wrench className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold text-sm">🔧 Herramientas en revisión / fuera de servicio</div>
                  <div className="text-xs text-muted-foreground">
                    {itemsFS.length} {itemsFS.length === 1 ? "ítem" : "ítems"} con {totalFS} unidades totales
                  </div>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {itemsFS.map(it => (
                  <span key={it.id} className="px-2 py-1 rounded-md bg-warning/10 border border-warning/30 text-xs">
                    {it.descripcion} <b>×{it.stock_fuera_servicio}</b>
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex-1 min-w-[280px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por descripción, ID, número de serie..."
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
            {CATEGORIAS_FILTROS.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "ítem" : "ítems"}
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">Cargando inventario...</CardContent></Card>
      ) : error ? (
        <Card className="border-destructive">
          <CardContent className="py-8 flex items-center gap-3 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <div>
              <div className="font-semibold">Error al cargar inventario</div>
              <div className="text-sm">{(error as Error).message}</div>
            </div>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            {items.length === 0 ? (
              <>
                <p className="text-muted-foreground">No hay ítems en inventario</p>
                {puedeEditar && (
                  <Button onClick={() => { setItemEditar(null); setDialogOpen(true); }} className="mt-4">
                    <Plus className="h-4 w-4" />
                    Crear primer ítem
                  </Button>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">Sin resultados</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(it => (
            <ItemCard
              key={it.id}
              item={it}
              puedeEditar={!!puedeEditar}
              onEditar={() => { setItemEditar(it); setDialogOpen(true); }}
              onEliminar={() => setItemEliminar(it)}
              onAjustar={() => setItemAjustar(it)}
              onReactivar={() => { setAccionReactivar("reactivar"); setItemReactivar(it); }}
              onDarDeBaja={() => { setAccionReactivar("dar_de_baja"); setItemReactivar(it); }}
              onHistorial={() => setItemHistorial(it)}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <ItemDialog open={dialogOpen} onOpenChange={setDialogOpen} item={itemEditar} />
      <AjusteDialog open={!!itemAjustar} onOpenChange={(o) => !o && setItemAjustar(null)} item={itemAjustar} />
      <ReactivarDialog
        open={!!itemReactivar}
        onOpenChange={(o) => !o && setItemReactivar(null)}
        item={itemReactivar}
        accion={accionReactivar}
      />
      <HistorialDialog
        open={!!itemHistorial}
        onOpenChange={(o) => !o && setItemHistorial(null)}
        item={itemHistorial}
      />
      <ConfirmDialog
        open={!!itemEliminar}
        onOpenChange={(o) => !o && setItemEliminar(null)}
        title={`¿Eliminar ${itemEliminar?.descripcion}?`}
        description="El ítem se desactivará. Los movimientos históricos quedan intactos."
        confirmText="Eliminar"
        variant="destructive"
        loading={eliminar.isPending}
        onConfirm={handleEliminar}
      />
    </div>
  );
}

function StatCard({
  label, value, icon: Icon, variant = "default", textValue = false,
}: {
  label: string;
  value: number | string;
  icon: any;
  variant?: "default" | "destructive" | "warning" | "muted";
  textValue?: boolean;
}) {
  const colors = {
    default: "text-foreground",
    destructive: "text-destructive",
    warning: "text-warning",
    muted: "text-muted-foreground",
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
            <div className={cn(textValue ? "text-2xl" : "text-3xl", "font-bold mt-1", colors[variant])}>
              {value}
            </div>
          </div>
          <Icon className={cn("h-5 w-5", colors[variant])} />
        </div>
      </CardContent>
    </Card>
  );
}

function ItemCard({
  item, puedeEditar, onEditar, onEliminar, onAjustar,
  onReactivar, onDarDeBaja, onHistorial,
}: {
  item: Inventario;
  puedeEditar: boolean;
  onEditar: () => void;
  onEliminar: () => void;
  onAjustar: () => void;
  onReactivar: () => void;
  onDarDeBaja: () => void;
  onHistorial: () => void;
}) {
  const critico = item.stock_minimo > 0 && item.stock_disponible <= item.stock_minimo;
  const total = (item.stock_disponible + item.stock_en_obra + item.stock_fuera_servicio) || 1;
  const pctDisp = (item.stock_disponible / total) * 100;
  const pctObra = (item.stock_en_obra / total) * 100;
  const pctFS = (item.stock_fuera_servicio / total) * 100;

  return (
    <Card className={cn("hover:border-primary/40 transition-colors", critico && "border-destructive/50")}>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 mb-1 flex-wrap">
              <h3 className="font-semibold break-words flex-1 min-w-0">{item.descripcion}</h3>
              <span className="text-xs text-muted-foreground flex-shrink-0">{item.item_id}</span>
              {critico && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-destructive/15 text-destructive border border-destructive/30 flex-shrink-0">
                  ⚠ STOCK CRÍTICO
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mb-2">
              <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold border", CATEGORIA_COLORS[item.categoria])}>
                {item.categoria}
              </span>
              {item.numero_serie && (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-muted text-muted-foreground">
                  S/N: {item.numero_serie}
                </span>
              )}
              {item.ubicacion_fisica && (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-primary/10 text-primary border border-primary/20 font-mono">
                  📍 {item.ubicacion_fisica}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-3 text-xs">
              <span><b className="text-success">{item.stock_disponible}</b> disp.</span>
              <span><b className="text-primary">{item.stock_en_obra}</b> en obra</span>
              {item.stock_fuera_servicio > 0 && (
                <span><b className="text-warning">{item.stock_fuera_servicio}</b> fuera servicio</span>
              )}
              {item.stock_minimo > 0 && (
                <span className="text-muted-foreground">mín: {item.stock_minimo}</span>
              )}
            </div>

            {/* Stock bar */}
            <div className="flex h-1 mt-2 rounded-full overflow-hidden bg-muted">
              {pctDisp > 0 && <div className="bg-success" style={{ width: `${pctDisp}%` }} />}
              {pctObra > 0 && <div className="bg-primary" style={{ width: `${pctObra}%` }} />}
              {pctFS > 0 && <div className="bg-warning" style={{ width: `${pctFS}%` }} />}
            </div>
          </div>

          {puedeEditar && (
            <div className="flex gap-1 flex-wrap pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50 sm:flex-shrink-0">
              <Button variant="ghost" size="sm" onClick={onHistorial}>
                <History className="h-3.5 w-3.5" /> Historial
              </Button>
              <Button variant="ghost" size="sm" onClick={onAjustar}>
                <Settings className="h-3.5 w-3.5" /> Ajustar
              </Button>
              {item.stock_fuera_servicio > 0 && (
                <>
                  <Button variant="ghost" size="sm" className="text-success" onClick={onReactivar}>
                    <CheckCircle className="h-3.5 w-3.5" /> Reincorporar
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={onDarDeBaja}>
                    <Trash className="h-3.5 w-3.5" /> Baja
                  </Button>
                </>
              )}
              <Button variant="ghost" size="icon" onClick={onEditar} className="h-8 w-8">
                <Edit className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost" size="icon" onClick={onEliminar}
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
