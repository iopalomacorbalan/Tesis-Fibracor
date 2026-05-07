import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useCrearCliente, useEditarCliente } from "./useClientes";
import { clienteSchema, type ClienteFormValues } from "./schemas";
import type { Cliente } from "@/types/database";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente?: Cliente | null;
}

const empty: ClienteFormValues = {
  nombre: "",
  cuit: "",
  contacto: "",
  email: "",
  telefono: "",
  direccion: "",
  notas: "",
};

export function ClienteDialog({ open, onOpenChange, cliente }: Props) {
  const isEdit = !!cliente;
  const crear = useCrearCliente();
  const editar = useEditarCliente();

  const [form, setForm] = useState<ClienteFormValues>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (cliente) {
      setForm({
        nombre: cliente.nombre,
        cuit: cliente.cuit ?? "",
        contacto: cliente.contacto ?? "",
        email: cliente.email ?? "",
        telefono: cliente.telefono ?? "",
        direccion: cliente.direccion ?? "",
        notas: cliente.notas ?? "",
      });
    } else if (open) {
      setForm(empty);
    }
    setErrors({});
  }, [cliente, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = clienteSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach(i => { errs[i.path.join(".")] = i.message; });
      setErrors(errs);
      toast.error("Revisá los errores del formulario");
      return;
    }
    try {
      const payload = {
        nombre: parsed.data.nombre,
        cuit: parsed.data.cuit || null,
        contacto: parsed.data.contacto || null,
        email: parsed.data.email || null,
        telefono: parsed.data.telefono || null,
        direccion: parsed.data.direccion || null,
        notas: parsed.data.notas || null,
      };
      if (isEdit && cliente) {
        await editar.mutateAsync({ id: cliente.id, patch: payload });
        toast.success("Cliente actualizado");
      } else {
        const c = await crear.mutateAsync(payload);
        toast.success(`Cliente ${c.cliente_id} creado`);
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  const loading = crear.isPending || editar.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Editar — ${cliente?.cliente_id}` : "Nuevo cliente"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Modificar los datos del cliente" : "Cargar un nuevo cliente al sistema"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre / Razón social *</Label>
            <Input
              id="nombre"
              value={form.nombre}
              onChange={(e) => setForm(f => ({ ...f, nombre: e.target.value }))}
              className={errors["nombre"] ? "border-destructive" : ""}
              autoFocus
            />
            {errors["nombre"] && <p className="text-sm text-destructive">{errors["nombre"]}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cuit">CUIT</Label>
              <Input
                id="cuit"
                placeholder="20-12345678-9"
                value={form.cuit ?? ""}
                onChange={(e) => setForm(f => ({ ...f, cuit: e.target.value }))}
                className={errors["cuit"] ? "border-destructive" : ""}
              />
              {errors["cuit"] && <p className="text-sm text-destructive">{errors["cuit"]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="contacto">Persona de contacto</Label>
              <Input
                id="contacto"
                placeholder="Nombre del referente"
                value={form.contacto ?? ""}
                onChange={(e) => setForm(f => ({ ...f, contacto: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="contacto@empresa.com"
                value={form.email ?? ""}
                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                className={errors["email"] ? "border-destructive" : ""}
              />
              {errors["email"] && <p className="text-sm text-destructive">{errors["email"]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input
                id="telefono"
                placeholder="+54 9 351..."
                value={form.telefono ?? ""}
                onChange={(e) => setForm(f => ({ ...f, telefono: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="direccion">Dirección</Label>
            <Input
              id="direccion"
              value={form.direccion ?? ""}
              onChange={(e) => setForm(f => ({ ...f, direccion: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notas">Notas</Label>
            <Textarea
              id="notas"
              rows={3}
              placeholder="Información adicional, condiciones especiales, etc."
              value={form.notas ?? ""}
              onChange={(e) => setForm(f => ({ ...f, notas: e.target.value }))}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Guardar cambios" : "Crear cliente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
