import { useState, useMemo } from "react";
import {
  Plus, Search, FileText, AlertCircle, Camera, Briefcase, User, Trash2, Eye, Edit,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useReportes, useEliminarReporte } from "./useReportes";
import { ReporteDialog } from "./ReporteDialog";
import { ReporteDetalle } from "./ReporteDetalle";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import type { ReporteConRelaciones } from "@/types/database";

export default function ReportesPage() {
  const { profile } = useAuth();
  const { data: reportes = [], isLoading, error } = useReportes();
  const eliminar = useEliminarReporte();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [repDetalle, setRepDetalle] = useState<ReporteConRelaciones | null>(null);
  const [repEliminar, setRepEliminar] = useState<ReporteConRelaciones | null>(null);
  const [repEditar, setRepEditar] = useState<ReporteConRelaciones | null>(null);
  const [dialogEditOpen, setDialogEditOpen] = useState(false);

  const puedeEliminar = profile && ["Direccion", "Operaciones"].includes(profile.area);
  // Direccion/Operaciones editan cualquiera. Los técnicos editan solo los propios.
  const puedeEditarSiempre = profile && ["Direccion", "Operaciones"].includes(profile.area);

  const filtered = useMemo(() => {
    return reportes.filter(r => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        r.reporte_id.toLowerCase().includes(q) ||
        (r.obra?.obra_id?.toLowerCase().includes(q) ?? false) ||
        (r.tecnico?.nombre?.toLowerCase().includes(q) ?? false) ||
        (r.descripcion?.toLowerCase().includes(q) ?? false) ||
        (r.trabajos_realizados?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [reportes, search]);

  const stats = useMemo(() => {
    const total = reportes.length;
    const conFotos = reportes.filter(r => (r.fotos?.length ?? 0) > 0).length;
    const totalFotos = reportes.reduce((s, r) => s + (r.fotos?.length ?? 0), 0);
    const semana = reportes.filter(r => {
      const dt = new Date(r.fecha).getTime();
      return Date.now() - dt < 7 * 24 * 3600 * 1000;
    }).length;
    return { total, conFotos, totalFotos, semana };
  }, [reportes]);

  const handleEliminar = async () => {
    if (!repEliminar) return;
    try {
      await eliminar.mutateAsync(repEliminar.id);
      toast.success(`Reporte ${repEliminar.reporte_id} eliminado`);
      setRepEliminar(null);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            Reportes
          </h1>
          <p className="text-muted-foreground mt-1">Documentación de trabajos en obra</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="lg">
          <Plus className="h-4 w-4" /> Nuevo reporte
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total reportes" value={stats.total} />
        <StatCard label="Esta semana" value={stats.semana} variant="primary" />
        <StatCard label="Con fotos" value={stats.conFotos} variant="success" />
        <StatCard label="Total fotos" value={stats.totalFotos} variant="default" />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por obra, técnico, contenido..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
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
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">Sin reportes</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(r => {
            const esAutor = profile && r.tecnico_id === profile.id;
            const puedeEditarEste = puedeEditarSiempre || esAutor;
            return (
              <ReporteCard
                key={r.id}
                reporte={r}
                puedeEliminar={!!puedeEliminar}
                puedeEditar={!!puedeEditarEste}
                onClick={() => setRepDetalle(r)}
                onEliminar={() => setRepEliminar(r)}
                onEditar={() => { setRepEditar(r); setDialogEditOpen(true); }}
              />
            );
          })}
        </div>
      )}

      <ReporteDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      <ReporteDialog
        open={dialogEditOpen}
        onOpenChange={(o) => { setDialogEditOpen(o); if (!o) setRepEditar(null); }}
        reporte={repEditar}
      />
      <ReporteDetalle
        open={!!repDetalle}
        onOpenChange={(o) => !o && setRepDetalle(null)}
        reporte={repDetalle}
      />
      <ConfirmDialog
        open={!!repEliminar}
        onOpenChange={(o) => !o && setRepEliminar(null)}
        title={`¿Eliminar reporte ${repEliminar?.reporte_id}?`}
        description="También se eliminan todas las fotos asociadas. Acción irreversible."
        confirmText="Eliminar"
        variant="destructive"
        loading={eliminar.isPending}
        onConfirm={handleEliminar}
      />
    </div>
  );
}

function StatCard({
  label, value, variant = "default",
}: {
  label: string; value: number;
  variant?: "default" | "primary" | "success";
}) {
  const colors = {
    default: "text-foreground",
    primary: "text-primary",
    success: "text-success",
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
        <div className={`text-3xl font-bold mt-1 ${colors[variant]}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function ReporteCard({
  reporte, puedeEliminar, puedeEditar, onClick, onEliminar, onEditar,
}: {
  reporte: ReporteConRelaciones;
  puedeEliminar: boolean;
  puedeEditar: boolean;
  onClick: () => void;
  onEliminar: () => void;
  onEditar: () => void;
}) {
  const numFotos = reporte.fotos?.length ?? 0;

  return (
    <Card
      className="hover:border-primary/40 transition-colors cursor-pointer overflow-hidden"
      onClick={onClick}
    >
      {numFotos > 0 && reporte.fotos && reporte.fotos[0].url && (
        <div className="aspect-video w-full bg-muted relative">
          <img
            loading="lazy"
            decoding="async"
            src={reporte.fotos[0].url}
            alt="Reporte"
            className="w-full h-full object-cover"
          />
          {numFotos > 1 && (
            <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/70 text-white text-xs flex items-center gap-1">
              <Camera className="h-3 w-3" /> +{numFotos - 1}
            </div>
          )}
        </div>
      )}

      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="font-bold text-sm">{reporte.reporte_id}</span>
          <span className="text-xs text-muted-foreground">{formatDate(reporte.fecha)}</span>
        </div>

        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2 gap-y-0.5 mb-2">
          {reporte.obra && (
            <span className="flex items-center gap-1">
              <Briefcase className="h-3 w-3" /> {reporte.obra.obra_id}
            </span>
          )}
          {reporte.tecnico && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" /> {reporte.tecnico.nombre}
            </span>
          )}
          {numFotos > 0 && (
            <span className="flex items-center gap-1">
              <Camera className="h-3 w-3" /> {numFotos} {numFotos === 1 ? "foto" : "fotos"}
            </span>
          )}
        </div>

        {reporte.descripcion && (
          <p className="text-sm line-clamp-2">{reporte.descripcion}</p>
        )}
        {!reporte.descripcion && reporte.trabajos_realizados && (
          <p className="text-sm line-clamp-2 text-muted-foreground">
            {reporte.trabajos_realizados}
          </p>
        )}

        <div className="flex justify-end gap-1 mt-2">
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onClick(); }}>
            <Eye className="h-3.5 w-3.5" /> Ver
          </Button>
          {puedeEditar && (
            <Button
              variant="ghost" size="sm"
              onClick={(e) => { e.stopPropagation(); onEditar(); }}
            >
              <Edit className="h-3.5 w-3.5" /> Editar
            </Button>
          )}
          {puedeEliminar && (
            <Button
              variant="ghost" size="icon"
              onClick={(e) => { e.stopPropagation(); onEliminar(); }}
              className="h-8 w-8 text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
