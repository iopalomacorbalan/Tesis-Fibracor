import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { normalizarTelefono } from "@/lib/whatsapp";
import type { Usuario, UserArea } from "@/types/database";
import { useCrearUsuario, useEditarUsuario, useCambiarPassword } from "./useGestionUsuarios";

export const AREAS: { value: UserArea; label: string }[] = [
  { value: "Tecnico", label: "Técnico" },
  { value: "Operaciones", label: "Operaciones" },
  { value: "Paniol", label: "Pañol" },
  { value: "Comercial", label: "Comercial" },
  { value: "Contabilidad", label: "Contabilidad" },
  { value: "Direccion", label: "Dirección" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usuario?: Usuario | null; // si viene, es edición
}

const VACIO = { nombre: "", email: "", telefono: "", area: "Tecnico" as UserArea, password: "" };

export function UsuarioDialog({ open, onOpenChange, usuario }: Props) {
  const isEdit = !!usuario;
  const { profile } = useAuth();
  const esDireccion = profile?.area === "Direccion";
  const crear = useCrearUsuario();
  const editar = useEditarUsuario();
  const cambiarPassword = useCambiarPassword();

  const [form, setForm] = useState(VACIO);
  const [verPassword, setVerPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setForm(usuario
      ? { nombre: usuario.nombre, email: usuario.email, telefono: usuario.telefono ?? "", area: usuario.area, password: "" }
      : VACIO);
    setErrors({});
    setVerPassword(false);
  }, [open, usuario]);

  const validar = () => {
    const errs: Record<string, string> = {};
    if (!form.nombre.trim()) errs.nombre = "Ingresá el nombre";
    if (!isEdit && !/^\S+@\S+\.\S+$/.test(form.email.trim())) errs.email = "Email inválido";
    if (!isEdit && form.password.length < 6) errs.password = "Mínimo 6 caracteres";
    if (isEdit && form.password && form.password.length < 6) errs.password = "Mínimo 6 caracteres";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validar()) return;
    try {
      if (isEdit && usuario) {
        await editar.mutateAsync({
          id: usuario.id,
          nombre: form.nombre.trim(),
          telefono: form.telefono.trim(),
          area: form.area,
        });
        if (form.password) {
          await cambiarPassword.mutateAsync({ id: usuario.id, password: form.password });
        }
        toast.success("Usuario actualizado");
      } else {
        await crear.mutateAsync({
          nombre: form.nombre.trim(),
          email: form.email.trim(),
          password: form.password,
          area: form.area,
          telefono: form.telefono.trim(),
        });
        toast.success(`Usuario ${form.nombre.trim()} creado`);
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  const loading = crear.isPending || editar.isPending || cambiarPassword.isPending;
  const telefonoInvalido = form.telefono.trim() !== "" && !normalizarTelefono(form.telefono);
  // Cambiarse el área a uno mismo puede dejarte sin acceso a esta pantalla
  const esUnoMismo = isEdit && usuario?.id === profile?.id;
  // Operaciones solo gestiona técnicos
  const areasDisponibles = esDireccion ? AREAS : AREAS.filter(a => a.value === "Tecnico");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Editar — ${usuario?.nombre}` : "Nuevo usuario"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modificá los datos. Dejá la contraseña vacía para no cambiarla."
              : "El usuario va a poder entrar a la app con este email y contraseña."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre completo *</Label>
            <Input
              id="nombre"
              value={form.nombre}
              onChange={(e) => setForm(f => ({ ...f, nombre: e.target.value }))}
              placeholder="Juan Pérez"
              className={errors.nombre ? "border-destructive" : ""}
              autoFocus
            />
            {errors.nombre && <p className="text-sm text-destructive">{errors.nombre}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email" type="email"
              value={form.email}
              onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="juan.perez@fibracor.com"
              disabled={isEdit}
              className={errors.email ? "border-destructive" : ""}
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefono">Celular (WhatsApp)</Label>
            <Input
              id="telefono"
              value={form.telefono}
              onChange={(e) => setForm(f => ({ ...f, telefono: e.target.value }))}
              placeholder="351 1234567"
            />
            {telefonoInvalido && (
              <p className="text-[11px] text-warning">
                ⚠️ No parece un celular válido. Usá código de área + número, ej: 351 1234567.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Área *</Label>
            <Select
              value={form.area}
              onValueChange={(v) => setForm(f => ({ ...f, area: v as UserArea }))}
              disabled={areasDisponibles.length === 1 || esUnoMismo}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(esUnoMismo ? AREAS : areasDisponibles).map(a => (
                  <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {esUnoMismo && (
              <p className="text-[11px] text-muted-foreground">
                No podés cambiar tu propia área. Pedíselo a otro usuario de Dirección.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{isEdit ? "Nueva contraseña" : "Contraseña *"}</Label>
            <div className="relative">
              <Input
                id="password"
                type={verPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder={isEdit ? "Dejar vacío para no cambiarla" : "Mínimo 6 caracteres"}
                autoComplete="new-password"
                className={errors.password ? "border-destructive pr-10" : "pr-10"}
              />
              <button
                type="button"
                onClick={() => setVerPassword(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                title={verPassword ? "Ocultar" : "Mostrar"}
              >
                {verPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Guardar cambios" : "Crear usuario"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
