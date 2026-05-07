import { useState, useMemo } from "react";
import {
  Plus, Search, Edit, Trash2, Mail, Phone, MapPin, FileText,
  Users, AlertCircle, Building2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useClientes, useEliminarCliente } from "./useClientes";
import { ClienteDialog } from "./ClienteDialog";
import { useAuth } from "@/lib/auth";
import type { Cliente } from "@/types/database";

export function ClientesList() {
  const { profile } = useAuth();
  const { data: clientes = [], isLoading, error } = useClientes();
  const eliminar = useEliminarCliente();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clienteEditar, setClienteEditar] = useState<Cliente | null>(null);
  const [clienteEliminar, setClienteEliminar] = useState<Cliente | null>(null);

  const puedeEditar = profile && ["Direccion", "Operaciones", "Comercial", "Contabilidad"].includes(profile.area);

  const filtered = useMemo(() => {
    if (!search) return clientes;
    const s = search.toLowerCase();
    return clientes.filter(c =>
      c.nombre.toLowerCase().includes(s) ||
      c.cliente_id.toLowerCase().includes(s) ||
      (c.cuit?.toLowerCase().includes(s) ?? false) ||
      (c.contacto?.toLowerCase().includes(s) ?? false) ||
      (c.email?.toLowerCase().includes(s) ?? false)
    );
  }, [clientes, search]);

  const handleEliminar = async () => {
    if (!clienteEliminar) return;
    try {
      await eliminar.mutateAsync(clienteEliminar.id);
      toast.success(`Cliente ${clienteEliminar.cliente_id} eliminado`);
      setClienteEliminar(null);
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
            placeholder="Buscar por nombre, CUIT, contacto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "cliente" : "clientes"}
        </div>
        {puedeEditar && (
          <Button onClick={() => { setClienteEditar(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4" />
            Nuevo cliente
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
              <div className="font-semibold">Error al cargar clientes</div>
              <div className="text-sm">{(error as Error).message}</div>
            </div>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            {clientes.length === 0 ? (
              <>
                <p className="text-muted-foreground">No hay clientes registrados</p>
                {puedeEditar && (
                  <Button onClick={() => { setClienteEditar(null); setDialogOpen(true); }} className="mt-4">
                    <Plus className="h-4 w-4" />
                    Crear primer cliente
                  </Button>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">Sin resultados para "{search}"</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map(c => (
            <ClienteCard
              key={c.id}
              cliente={c}
              puedeEditar={!!puedeEditar}
              onEditar={(cl) => { setClienteEditar(cl); setDialogOpen(true); }}
              onEliminar={(cl) => setClienteEliminar(cl)}
            />
          ))}
        </div>
      )}

      <ClienteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        cliente={clienteEditar}
      />
      <ConfirmDialog
        open={!!clienteEliminar}
        onOpenChange={(o) => !o && setClienteEliminar(null)}
        title={`¿Eliminar ${clienteEliminar?.nombre}?`}
        description="El cliente se marcará como eliminado y no aparecerá más en las listas. Las obras existentes que lo referencien quedan intactas."
        confirmText="Eliminar"
        variant="destructive"
        loading={eliminar.isPending}
        onConfirm={handleEliminar}
      />
    </div>
  );
}

function ClienteCard({
  cliente, puedeEditar, onEditar, onEliminar,
}: {
  cliente: Cliente;
  puedeEditar: boolean;
  onEditar: (c: Cliente) => void;
  onEliminar: (c: Cliente) => void;
}) {
  return (
    <Card className="hover:border-primary/40 transition-colors">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            <Building2 className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="min-w-0">
                <h3 className="font-bold truncate">{cliente.nombre}</h3>
                <span className="text-xs text-muted-foreground">{cliente.cliente_id}</span>
              </div>
              {puedeEditar && (
                <div className="flex gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => onEditar(cliente)} className="h-8 w-8">
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => onEliminar(cliente)}
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-1 text-xs text-muted-foreground mt-2">
              {cliente.cuit && (
                <div className="flex items-center gap-2">
                  <FileText className="h-3 w-3" /> {cliente.cuit}
                </div>
              )}
              {cliente.contacto && (
                <div className="flex items-center gap-2">
                  <Users className="h-3 w-3" /> {cliente.contacto}
                </div>
              )}
              {cliente.email && (
                <div className="flex items-center gap-2 truncate">
                  <Mail className="h-3 w-3 flex-shrink-0" />
                  <a href={`mailto:${cliente.email}`} className="hover:text-foreground truncate">
                    {cliente.email}
                  </a>
                </div>
              )}
              {cliente.telefono && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3 w-3" />
                  <a href={`tel:${cliente.telefono}`} className="hover:text-foreground">
                    {cliente.telefono}
                  </a>
                </div>
              )}
              {cliente.direccion && (
                <div className="flex items-center gap-2 truncate">
                  <MapPin className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{cliente.direccion}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
