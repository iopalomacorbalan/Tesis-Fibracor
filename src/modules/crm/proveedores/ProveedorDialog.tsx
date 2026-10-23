import { useState, useEffect } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useCrearProveedor, useEditarProveedor, useRubros } from "./useProveedores";
import { proveedorSchema, RUBROS_SUGERIDOS, type ProveedorFormValues } from "./schemas";
import type { Proveedor } from "@/types/database";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proveedor?: Proveedor | null;
}

const empty: ProveedorFormValues = {
  nombre: "", cuit: "", contacto: "", email: "",
  telefono: "", direccion: "", rubros: [], notas: "",
};

export function ProveedorDialog({ open, onOpenChange, proveedor }: Props) {
  const isEdit = !!proveedor;
  const crear = useCrearProveedor();
  const editar = useEditarProveedor();
  const { data: rubrosDb = [] } = useRubros();
  // Catálogo de la base; si todavía no cargó, las sugerencias de siempre
  const rubrosCatalogo = rubrosDb.length > 0 ? rubrosDb : RUBROS_SUGERIDOS;

  const [form, setForm] = useState<ProveedorFormValues>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [nuevoRubro, setNuevoRubro] = useState("");

  useEffect(() => {
    if (proveedor) {
      setForm({
        nombre: proveedor.nombre,
        cuit: proveedor.cuit ?? "",
        contacto: proveedor.contacto ?? "",
        email: proveedor.email ?? "",
        telefono: proveedor.telefono ?? "",
        direccion: proveedor.direccion ?? "",
        rubros: proveedor.rubros ?? [],
        notas: proveedor.notas ?? "",
      });
    } else if (open) {
      setForm(empty);
    }
    setErrors({});
    setNuevoRubro("");
  }, [proveedor, open]);

  const toggleRubro = (rubro: string) => {
    setForm(f => ({
      ...f,
      rubros: f.rubros?.includes(rubro)
        ? f.rubros.filter(r => r !== rubro)
        : [...(f.rubros ?? []), rubro],
    }));
  };

  const agregarNuevoRubro = () => {
    const escrito = nuevoRubro.trim();
    if (!escrito) return;
    // Si ya existe con otras mayúsculas, se usa el del catálogo (no se duplica)
    const r = rubrosCatalogo.find(c => c.toLowerCase() === escrito.toLowerCase()) ?? escrito;
    if (!form.rubros?.some(x => x.toLowerCase() === r.toLowerCase())) {
      setForm(f => ({ ...f, rubros: [...(f.rubros ?? []), r] }));
    }
    setNuevoRubro("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = proveedorSchema.safeParse(form);
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
        cuit: parsed.data.cuit,
        contacto: parsed.data.contacto,
        email: parsed.data.email,
        telefono: parsed.data.telefono,
        direccion: parsed.data.direccion,
        rubros: parsed.data.rubros,
        notas: parsed.data.notas?.trim() || null,
      };
      if (isEdit && proveedor) {
        await editar.mutateAsync({ id: proveedor.id, patch: payload });
        toast.success("Proveedor actualizado");
      } else {
        const p = await crear.mutateAsync(payload);
        toast.success(`Proveedor ${p.proveedor_id} creado`);
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
          <DialogTitle>{isEdit ? `Editar — ${proveedor?.proveedor_id}` : "Nuevo proveedor"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Modificar los datos del proveedor" : "Cargar un nuevo proveedor al sistema"}
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
              <Label htmlFor="cuit">CUIT *</Label>
              <Input
                id="cuit"
                placeholder="30-12345678-9"
                value={form.cuit ?? ""}
                onChange={(e) => setForm(f => ({ ...f, cuit: e.target.value }))}
                className={errors["cuit"] ? "border-destructive" : ""}
              />
              {errors["cuit"] && <p className="text-sm text-destructive">{errors["cuit"]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="contacto">Persona de contacto *</Label>
              <Input
                id="contacto"
                value={form.contacto ?? ""}
                onChange={(e) => setForm(f => ({ ...f, contacto: e.target.value }))}
                className={errors["contacto"] ? "border-destructive" : ""}
              />
              {errors["contacto"] && <p className="text-sm text-destructive">{errors["contacto"]}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={form.email ?? ""}
                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                className={errors["email"] ? "border-destructive" : ""}
              />
              {errors["email"] && <p className="text-sm text-destructive">{errors["email"]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono *</Label>
              <Input
                id="telefono"
                value={form.telefono ?? ""}
                onChange={(e) => setForm(f => ({ ...f, telefono: e.target.value }))}
                className={errors["telefono"] ? "border-destructive" : ""}
              />
              {errors["telefono"] && <p className="text-sm text-destructive">{errors["telefono"]}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="direccion">Dirección *</Label>
            <Input
              id="direccion"
              value={form.direccion ?? ""}
              onChange={(e) => setForm(f => ({ ...f, direccion: e.target.value }))}
              className={errors["direccion"] ? "border-destructive" : ""}
            />
            {errors["direccion"] && <p className="text-sm text-destructive">{errors["direccion"]}</p>}
          </div>

          {/* Rubros */}
          <div className="space-y-2">
            <Label>Rubros que provee *</Label>
            <div className={`flex flex-wrap gap-2 p-3 bg-secondary/30 border rounded-md ${
              errors["rubros"] ? "border-destructive" : "border-input"
            }`}>
              {rubrosCatalogo.map(r => {
                const checked = form.rubros?.includes(r);
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggleRubro(r)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      checked
                        ? "bg-primary text-primary-foreground"
                        : "bg-background hover:bg-accent"
                    }`}
                  >
                    {r}
                  </button>
                );
              })}
              {/* Custom rubros (no en sugeridos) */}
              {form.rubros?.filter(r => !rubrosCatalogo.includes(r)).map(r => (
                <span key={r} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground">
                  {r}
                  <button type="button" onClick={() => toggleRubro(r)} className="hover:opacity-70">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Agregar otro rubro..."
                value={nuevoRubro}
                onChange={(e) => setNuevoRubro(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    agregarNuevoRubro();
                  }
                }}
                className="flex-1"
              />
              <Button type="button" variant="outline" onClick={agregarNuevoRubro} disabled={!nuevoRubro.trim()}>
                Agregar
              </Button>
            </div>
            {errors["rubros"] && <p className="text-sm text-destructive">{errors["rubros"]}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notas">Notas</Label>
            <Textarea
              id="notas"
              rows={2}
              placeholder="Condiciones de pago, descuentos, observaciones..."
              value={form.notas ?? ""}
              onChange={(e) => setForm(f => ({ ...f, notas: e.target.value }))}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Guardar cambios" : "Crear proveedor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
