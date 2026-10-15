import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, Pencil, Phone, Plus, Search, UserCog, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { Usuario } from "@/types/database";
import { useTodosUsuarios, useEditarUsuario } from "./useGestionUsuarios";
import { UsuarioDialog, AREAS } from "./UsuarioDialog";

type Filtro = "Tecnico" | "todos";

export default function UsuariosPage() {
  const { profile } = useAuth();
  const { data: usuarios = [], isLoading } = useTodosUsuarios();
  const editar = useEditarUsuario();

  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [verInactivos, setVerInactivos] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [usuarioEditar, setUsuarioEditar] = useState<Usuario | null>(null);

  const esDireccion = profile?.area === "Direccion";

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return usuarios.filter(u =>
      (filtro === "todos" || u.area === filtro)
      && (verInactivos || u.activo)
      && (!q || u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)),
    );
  }, [usuarios, filtro, busqueda, verInactivos]);

  const cantidad = (f: Filtro) =>
    usuarios.filter(u => (f === "todos" || u.area === f) && (verInactivos || u.activo)).length;

  if (profile && !["Direccion", "Operaciones"].includes(profile.area)) {
    return <Navigate to="/" replace />;
  }

  // Operaciones solo gestiona técnicos
  const puedeGestionar = (u: Usuario) => esDireccion || u.area === "Tecnico";

  const abrirNuevo = () => { setUsuarioEditar(null); setDialogOpen(true); };
  const abrirEditar = (u: Usuario) => { setUsuarioEditar(u); setDialogOpen(true); };

  const toggleActivo = async (u: Usuario) => {
    const accion = u.activo ? "desactivar" : "reactivar";
    if (!confirm(`¿${accion[0].toUpperCase() + accion.slice(1)} a ${u.nombre}?${u.activo ? " No va a poder iniciar sesión." : ""}`)) return;
    try {
      await editar.mutateAsync({ id: u.id, activo: !u.activo });
      toast.success(`${u.nombre} ${u.activo ? "desactivado" : "reactivado"}`);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  const etiquetaArea = (area: string) => AREAS.find(a => a.value === area)?.label ?? area;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
            <UserCog className="h-8 w-8 text-primary" />
            Usuarios
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Alta de técnicos y personal con acceso a la app.
          </p>
        </div>
        <Button onClick={abrirNuevo}>
          <Plus className="h-4 w-4" />
          {esDireccion ? "Nuevo usuario" : "Nuevo técnico"}
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o email..."
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {(["todos", "Tecnico"] as Filtro[]).map(f => (
            <Button
              key={f}
              variant={filtro === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFiltro(f)}
            >
              {f === "todos" ? "Todos" : "Técnicos"} ({cantidad(f)})
            </Button>
          ))}
          <label className="flex items-center gap-2 px-2 text-sm text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={verInactivos}
              onChange={(e) => setVerInactivos(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Ver inactivos
          </label>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
      ) : visibles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            {usuarios.length === 0 ? "No hay usuarios cargados." : "No hay usuarios con esos filtros."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {visibles.map(u => (
            <Card key={u.id} className={cn(!u.activo && "opacity-60")}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm shrink-0">
                    {u.nombre.split(" ").slice(0, 2).map(s => s[0]).join("").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{u.nombre}</div>
                    <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                  </div>
                  <span className={cn(
                    "px-2 py-0.5 rounded-md text-[11px] border shrink-0",
                    u.activo ? "bg-secondary" : "bg-destructive/10 text-destructive border-destructive/30",
                  )}>
                    {u.activo ? etiquetaArea(u.area) : "Inactivo"}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  {u.telefono || <span className="italic">Sin teléfono</span>}
                </div>

                {puedeGestionar(u) && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => abrirEditar(u)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </Button>
                    {u.id !== profile?.id && (
                      <Button
                        variant="ghost" size="sm"
                        className={u.activo ? "text-muted-foreground hover:text-destructive" : "text-success"}
                        onClick={() => toggleActivo(u)}
                        disabled={editar.isPending}
                      >
                        {u.activo
                          ? <><UserX className="h-3.5 w-3.5" /> Desactivar</>
                          : <><UserCheck className="h-3.5 w-3.5" /> Reactivar</>}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <UsuarioDialog open={dialogOpen} onOpenChange={setDialogOpen} usuario={usuarioEditar} />
    </div>
  );
}
