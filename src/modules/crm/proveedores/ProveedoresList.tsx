import { useState, useMemo } from "react";
import {
  Plus, Search, Edit, Trash2, Mail, Phone, MapPin, FileText,
  Truck, AlertCircle, Filter,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useProveedores, useEliminarProveedor } from "./useProveedores";
import { ProveedorDialog } from "./ProveedorDialog";
import { useAuth } from "@/lib/auth";
import type { Proveedor } from "@/types/database";

export function ProveedoresList() {
  const { profile } = useAuth();
  const { data: proveedores = [], isLoading, error } = useProveedores();
  const eliminar = useEliminarProveedor();

  const [search, setSearch] = useState("");
  const [filtroRubro, setFiltroRubro] = useState<string>("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [provEditar, setProvEditar] = useState<Proveedor | null>(null);
  const [provEliminar, setProvEliminar] = useState<Proveedor | null>(null);

  const puedeEditar = profile && ["Direccion", "Operaciones", "Paniol", "Contabilidad"].includes(profile.area);

  // Listado de rubros únicos
  const rubrosDisponibles = useMemo(() => {
    const set = new Set<string>();
    proveedores.forEach(p => p.rubros?.forEach(r => set.add(r)));
    return ["todos", ...Array.from(set).sort()];
  }, [proveedores]);

  const filtered = useMemo(() => {
    return proveedores.filter(p => {
      if (filtroRubro !== "todos" && !p.rubros?.includes(filtroRubro)) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          p.nombre.toLowerCase().includes(s) ||
          p.proveedor_id.toLowerCase().includes(s) ||
          (p.cuit?.toLowerCase().includes(s) ?? false) ||
          (p.contacto?.toLowerCase().includes(s) ?? false) ||
          (p.email?.toLowerCase().includes(s) ?? false) ||
          (p.rubros?.some(r => r.toLowerCase().includes(s)) ?? false)
        );
      }
      return true;
    });
  }, [proveedores, search, filtroRubro]);

  const handleEliminar = async () => {
    if (!provEliminar) return;
    try {
      await eliminar.mutateAsync(provEliminar.id);
      toast.success(`Proveedor ${provEliminar.proveedor_id} eliminado`);
      setProvEliminar(null);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex-1 min-w-[280px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, CUIT, rubro..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroRubro} onValueChange={setFiltroRubro}>
          <SelectTrigger className="w-[200px]">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {rubrosDisponibles.map(r => (
              <SelectItem key={r} value={r}>{r === "todos" ? "Todos los rubros" : r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "proveedor" : "proveedores"}
        </div>
        {puedeEditar && (
          <Button onClick={() => { setProvEditar(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4" />
            Nuevo proveedor
          </Button>
        )}
      </div>

      {/* Lista */}
      {isLoading ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">Cargando...</CardContent></Card>
      ) : error ? (
        <Card className="border-destructive">
          <CardContent className="py-8 flex items-center gap-3 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <div>
              <div className="font-semibold">Error al cargar proveedores</div>
              <div className="text-sm">{(error as Error).message}</div>
            </div>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Truck className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            {proveedores.length === 0 ? (
              <>
                <p className="text-muted-foreground">No hay proveedores registrados</p>
                {puedeEditar && (
                  <Button onClick={() => { setProvEditar(null); setDialogOpen(true); }} className="mt-4">
                    <Plus className="h-4 w-4" />
                    Crear primer proveedor
                  </Button>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">Sin resultados</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map(p => (
            <ProveedorCard
              key={p.id}
              proveedor={p}
              puedeEditar={!!puedeEditar}
              onEditar={(pr) => { setProvEditar(pr); setDialogOpen(true); }}
              onEliminar={(pr) => setProvEliminar(pr)}
            />
          ))}
        </div>
      )}

      <ProveedorDialog open={dialogOpen} onOpenChange={setDialogOpen} proveedor={provEditar} />
      <ConfirmDialog
        open={!!provEliminar}
        onOpenChange={(o) => !o && setProvEliminar(null)}
        title={`¿Eliminar ${provEliminar?.nombre}?`}
        description="El proveedor se desactivará y no aparecerá más en las listas. Las compras existentes que lo referencien quedan intactas."
        confirmText="Eliminar"
        variant="destructive"
        loading={eliminar.isPending}
        onConfirm={handleEliminar}
      />
    </div>
  );
}

function ProveedorCard({
  proveedor, puedeEditar, onEditar, onEliminar,
}: {
  proveedor: Proveedor;
  puedeEditar: boolean;
  onEditar: (p: Proveedor) => void;
  onEliminar: (p: Proveedor) => void;
}) {
  return (
    <Card className="hover:border-primary/40 transition-colors">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-lg bg-warning/15 text-warning flex items-center justify-center flex-shrink-0">
            <Truck className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="min-w-0">
                <h3 className="font-bold truncate">{proveedor.nombre}</h3>
                <span className="text-xs text-muted-foreground">{proveedor.proveedor_id}</span>
              </div>
              {puedeEditar && (
                <div className="flex gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => onEditar(proveedor)} className="h-8 w-8">
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => onEliminar(proveedor)}
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>

            {/* Rubros */}
            {proveedor.rubros && proveedor.rubros.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2 mb-2">
                {proveedor.rubros.map(r => (
                  <span
                    key={r}
                    className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-warning/15 text-warning border border-warning/30"
                  >
                    {r}
                  </span>
                ))}
              </div>
            )}

            <div className="space-y-1 text-xs text-muted-foreground mt-2">
              {proveedor.cuit && (
                <div className="flex items-center gap-2">
                  <FileText className="h-3 w-3" /> {proveedor.cuit}
                </div>
              )}
              {proveedor.contacto && (
                <div className="flex items-center gap-2">
                  👤 {proveedor.contacto}
                </div>
              )}
              {proveedor.email && (
                <div className="flex items-center gap-2 truncate">
                  <Mail className="h-3 w-3 flex-shrink-0" />
                  <a href={`mailto:${proveedor.email}`} className="hover:text-foreground truncate">
                    {proveedor.email}
                  </a>
                </div>
              )}
              {proveedor.telefono && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3 w-3" />
                  <a href={`tel:${proveedor.telefono}`} className="hover:text-foreground">
                    {proveedor.telefono}
                  </a>
                </div>
              )}
              {proveedor.direccion && (
                <div className="flex items-center gap-2 truncate">
                  <MapPin className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{proveedor.direccion}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
