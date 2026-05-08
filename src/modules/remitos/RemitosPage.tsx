import { useState, useMemo } from "react";
import {
  Plus, Search, FileText, AlertCircle, Briefcase, User,
  FileDown, Edit, Trash2, Eye, ScrollText,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useRemitos, useEliminarRemito } from "./useRemitos";
import { RemitoDialog } from "./RemitoDialog";
import { RemitoExportarDialog } from "./RemitoExportarDialog";
import { useAuth } from "@/lib/auth";
import { formatDate, cn } from "@/lib/utils";
import type { RemitoConRelaciones } from "@/types/database";

export default function RemitosPage() {
  const { profile } = useAuth();
  const { data: remitos = [], isLoading, error } = useRemitos();
  const eliminar = useEliminarRemito();

  const [search, setSearch] = useState("");
  const [filtroFirma, setFiltroFirma] = useState<string>("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [remEditar, setRemEditar] = useState<RemitoConRelaciones | null>(null);
  const [remEliminar, setRemEliminar] = useState<RemitoConRelaciones | null>(null);
  const [remExportar, setRemExportar] = useState<RemitoConRelaciones | null>(null);

  const puedeCrear = profile && ["Direccion", "Operaciones", "Comercial", "Paniol"].includes(profile.area);
  const puedeEditar = puedeCrear;
  const puedeEliminar = profile && ["Direccion", "Operaciones"].includes(profile.area);

  const filtered = useMemo(() => {
    return remitos.filter(r => {
      if (filtroFirma === "firmados" && !r.recibido_por) return false;
      if (filtroFirma === "sin_firmar" && r.recibido_por) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          r.remito_id.toLowerCase().includes(q) ||
          (r.obra?.obra_id?.toLowerCase().includes(q) ?? false) ||
          (r.cliente?.nombre?.toLowerCase().includes(q) ?? false) ||
          (r.recibido_por?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [remitos, search, filtroFirma]);

  const stats = useMemo(() => ({
    total: remitos.length,
    sin_firmar: remitos.filter(r => !r.recibido_por).length,
    firmados: remitos.filter(r => r.recibido_por).length,
    items_total: remitos.reduce((s, r) => s + (r.items?.length ?? 0), 0),
  }), [remitos]);

  const handleEliminar = async () => {
    if (!remEliminar) return;
    try {
      await eliminar.mutateAsync(remEliminar.id);
      toast.success(`Remito ${remEliminar.remito_id} eliminado`);
      setRemEliminar(null);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
            <ScrollText className="h-8 w-8 text-primary" />
            Remitos
          </h1>
          <p className="text-muted-foreground mt-1">Entregas a clientes</p>
        </div>
        {puedeCrear && (
          <Button onClick={() => { setRemEditar(null); setDialogOpen(true); }} size="lg">
            <Plus className="h-4 w-4" /> Nuevo remito
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total remitos" value={stats.total} />
        <StatCard label="Sin firmar" value={stats.sin_firmar} variant={stats.sin_firmar > 0 ? "warning" : "muted"} />
        <StatCard label="Firmados" value={stats.firmados} variant="success" />
        <StatCard label="Ítems entregados" value={stats.items_total} />
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex-1 min-w-[280px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por remito, obra, cliente, receptor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroFirma} onValueChange={setFiltroFirma}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="sin_firmar">Sin firmar</SelectItem>
            <SelectItem value="firmados">Firmados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">Cargando...</CardContent></Card>
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
            <ScrollText className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">Sin remitos</p>
            {puedeCrear && remitos.length === 0 && (
              <Button onClick={() => { setRemEditar(null); setDialogOpen(true); }} className="mt-4">
                <Plus className="h-4 w-4" />
                Crear primer remito
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => (
            <RemitoCard
              key={r.id}
              remito={r}
              puedeEditar={!!puedeEditar}
              puedeEliminar={!!puedeEliminar}
              onExportar={() => setRemExportar(r)}
              onEditar={() => { setRemEditar(r); setDialogOpen(true); }}
              onEliminar={() => setRemEliminar(r)}
            />
          ))}
        </div>
      )}

      <RemitoDialog open={dialogOpen} onOpenChange={(o) => {
        setDialogOpen(o);
        if (!o) setRemEditar(null);
      }} remito={remEditar} />

      <RemitoExportarDialog
        open={!!remExportar}
        onOpenChange={(o) => !o && setRemExportar(null)}
        remito={remExportar}
      />

      <ConfirmDialog
        open={!!remEliminar}
        onOpenChange={(o) => !o && setRemEliminar(null)}
        title={`¿Eliminar remito ${remEliminar?.remito_id}?`}
        description="También se eliminan los ítems asociados. Los retiros vuelven a estar disponibles para incluir en otro remito. Acción irreversible."
        confirmText="Eliminar"
        variant="destructive"
        loading={eliminar.isPending}
        onConfirm={handleEliminar}
      />
    </div>
  );
}

function StatCard({ label, value, variant = "default" }: {
  label: string; value: number;
  variant?: "default" | "warning" | "success" | "muted";
}) {
  const colors = {
    default: "text-foreground", warning: "text-warning",
    success: "text-success", muted: "text-muted-foreground",
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

function RemitoCard({
  remito, puedeEditar, puedeEliminar,
  onExportar, onEditar, onEliminar,
}: {
  remito: RemitoConRelaciones;
  puedeEditar: boolean;
  puedeEliminar: boolean;
  onExportar: () => void;
  onEditar: () => void;
  onEliminar: () => void;
}) {
  const items = remito.items?.length ?? 0;
  const firmado = !!remito.recibido_por;

  return (
    <Card className="hover:border-primary/40 transition-colors">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-bold">{remito.remito_id}</span>
              {firmado ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-success/15 text-success border-success/30">
                  ✓ Firmado
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-warning/15 text-warning border-warning/30">
                  Sin firma
                </span>
              )}
            </div>

            <div className="text-sm font-medium">
              {remito.cliente?.nombre ?? <span className="text-muted-foreground italic">Sin cliente</span>}
            </div>

            <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
              {remito.obra ? (
                <span className="flex items-center gap-1">
                  <Briefcase className="h-3 w-3" /> {remito.obra.obra_id}
                  {remito.obra.nombre_obra && ` · ${remito.obra.nombre_obra}`}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-primary">
                  <User className="h-3 w-3" /> Entrega directa
                </span>
              )}
              <span>📅 {formatDate(remito.fecha)}</span>
              <span>{items} {items === 1 ? "ítem" : "ítems"}</span>
              {remito.recibido_por && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" /> {remito.recibido_por}
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-1 flex-wrap pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50 sm:flex-shrink-0">
            <Button variant="ghost" size="sm" onClick={onExportar} title="Descargar PDF">
              <FileDown className="h-3.5 w-3.5" /> PDF
            </Button>
            {puedeEditar && (
              <Button variant="ghost" size="sm" onClick={onEditar}>
                <Edit className="h-3.5 w-3.5" /> Editar
              </Button>
            )}
            {puedeEliminar && (
              <Button
                variant="ghost" size="icon"
                onClick={onEliminar}
                className="h-8 w-8 text-destructive hover:bg-destructive/10"
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
