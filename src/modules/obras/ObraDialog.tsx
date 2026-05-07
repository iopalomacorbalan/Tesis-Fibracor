import { useState, useEffect } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useClientes, useCrearCliente } from "./useClientes";
import { useUsuarios, useTecnicos } from "./useUsuarios";
import { useCrearObra, useEditarObra } from "./useObras";
import { obraSchema, type ObraFormValues } from "./schemas";
import type { ObraConRelaciones } from "@/types/database";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  obra?: ObraConRelaciones | null; // si viene, es edición
}

export function ObraDialog({ open, onOpenChange, obra }: Props) {
  const isEdit = !!obra;
  const { data: clientes = [] } = useClientes();
  const { data: jefesPosibles = [] } = useUsuarios(["Direccion", "Operaciones", "Tecnico"]);
  const { data: tecnicos = [] } = useTecnicos();
  const crearObra = useCrearObra();
  const editarObra = useEditarObra();
  const crearCliente = useCrearCliente();

  const [form, setForm] = useState<ObraFormValues>({
    cliente_id: null,
    nombre_obra: "",
    sitio: "",
    alcance_tecnico: "",
    fecha_inicio_est: "",
    fecha_fin_est: "",
    presupuesto: 0,
    jefe_obra_id: null,
    observaciones: "",
    tecnicos_ids: [],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showNuevoCliente, setShowNuevoCliente] = useState(false);
  const [nuevoClienteNombre, setNuevoClienteNombre] = useState("");

  useEffect(() => {
    if (obra) {
      setForm({
        cliente_id: obra.cliente_id,
        nombre_obra: obra.nombre_obra ?? "",
        sitio: obra.sitio ?? "",
        alcance_tecnico: obra.alcance_tecnico ?? "",
        fecha_inicio_est: obra.fecha_inicio_est ?? "",
        fecha_fin_est: obra.fecha_fin_est ?? "",
        presupuesto: obra.presupuesto ?? 0,
        jefe_obra_id: obra.jefe_obra_id,
        observaciones: obra.observaciones ?? "",
        tecnicos_ids: obra.tecnicos?.map(t => t.id) ?? [],
      });
    } else if (open) {
      setForm({
        cliente_id: null,
        nombre_obra: "",
        sitio: "",
        alcance_tecnico: "",
        fecha_inicio_est: "",
        fecha_fin_est: "",
        presupuesto: 0,
        jefe_obra_id: null,
        observaciones: "",
        tecnicos_ids: [],
      });
    }
    setErrors({});
  }, [obra, open]);

  const handleCrearCliente = async () => {
    if (!nuevoClienteNombre.trim()) return;
    try {
      const cli = await crearCliente.mutateAsync({ nombre: nuevoClienteNombre.trim() });
      setForm(f => ({ ...f, cliente_id: cli.id }));
      setNuevoClienteNombre("");
      setShowNuevoCliente(false);
      toast.success("Cliente creado");
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  const toggleTecnico = (tid: string) => {
    setForm(f => ({
      ...f,
      tecnicos_ids: f.tecnicos_ids?.includes(tid)
        ? f.tecnicos_ids.filter(x => x !== tid)
        : [...(f.tecnicos_ids ?? []), tid],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = obraSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach(i => { errs[i.path.join(".")] = i.message; });
      setErrors(errs);
      toast.error("Revisá los errores del formulario");
      return;
    }
    try {
      if (isEdit && obra) {
        await editarObra.mutateAsync({
          id: obra.id,
          patch: {
            cliente_id: parsed.data.cliente_id,
            nombre_obra: parsed.data.nombre_obra,
            sitio: parsed.data.sitio ?? null,
            alcance_tecnico: parsed.data.alcance_tecnico ?? null,
            fecha_inicio_est: parsed.data.fecha_inicio_est || null,
            fecha_fin_est: parsed.data.fecha_fin_est || null,
            presupuesto: parsed.data.presupuesto ?? 0,
            jefe_obra_id: parsed.data.jefe_obra_id ?? null,
            observaciones: parsed.data.observaciones ?? null,
          },
          tecnicos_ids: parsed.data.tecnicos_ids,
        });
        toast.success("Obra actualizada");
      } else {
        const obraNueva = await crearObra.mutateAsync({
          cliente_id: parsed.data.cliente_id,
          nombre_obra: parsed.data.nombre_obra,
          sitio: parsed.data.sitio,
          alcance_tecnico: parsed.data.alcance_tecnico,
          fecha_inicio_est: parsed.data.fecha_inicio_est || null,
          fecha_fin_est: parsed.data.fecha_fin_est || null,
          presupuesto: parsed.data.presupuesto,
          jefe_obra_id: parsed.data.jefe_obra_id,
          observaciones: parsed.data.observaciones,
          tecnicos_ids: parsed.data.tecnicos_ids,
        });
        toast.success(`Obra ${obraNueva.obra_id} creada`);
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  const loading = crearObra.isPending || editarObra.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Editar — ${obra?.obra_id}` : "Nueva obra"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Modificar los datos de la obra" : "Cargar una nueva orden de trabajo"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Cliente */}
          <div className="space-y-2">
            <Label>Cliente *</Label>
            {!showNuevoCliente ? (
              <div className="flex gap-2">
                <Select
                  value={form.cliente_id ?? ""}
                  onValueChange={(v) => setForm(f => ({ ...f, cliente_id: v || null }))}
                >
                  <SelectTrigger className={errors["cliente_id"] ? "border-destructive" : ""}>
                    <SelectValue placeholder="Seleccionar cliente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                    ))}
                    {clientes.length === 0 && (
                      <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                        No hay clientes. Creá uno con el botón +
                      </div>
                    )}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="icon" onClick={() => setShowNuevoCliente(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder="Nombre del nuevo cliente"
                  value={nuevoClienteNombre}
                  onChange={(e) => setNuevoClienteNombre(e.target.value)}
                  autoFocus
                />
                <Button type="button" onClick={handleCrearCliente} disabled={!nuevoClienteNombre.trim() || crearCliente.isPending}>
                  {crearCliente.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowNuevoCliente(false)}>Cancelar</Button>
              </div>
            )}
            {errors["cliente_id"] && <p className="text-sm text-destructive">{errors["cliente_id"]}</p>}
          </div>

          {/* Nombre y sitio */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nombre_obra">Nombre obra *</Label>
              <Input
                id="nombre_obra"
                value={form.nombre_obra}
                onChange={(e) => setForm(f => ({ ...f, nombre_obra: e.target.value }))}
                className={errors["nombre_obra"] ? "border-destructive" : ""}
              />
              {errors["nombre_obra"] && <p className="text-sm text-destructive">{errors["nombre_obra"]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="sitio">Sitio / dirección</Label>
              <Input
                id="sitio"
                value={form.sitio ?? ""}
                onChange={(e) => setForm(f => ({ ...f, sitio: e.target.value }))}
              />
            </div>
          </div>

          {/* Alcance */}
          <div className="space-y-2">
            <Label htmlFor="alcance">Alcance técnico</Label>
            <Textarea
              id="alcance"
              rows={3}
              value={form.alcance_tecnico ?? ""}
              onChange={(e) => setForm(f => ({ ...f, alcance_tecnico: e.target.value }))}
              placeholder="Descripción de los trabajos..."
            />
          </div>

          {/* Fechas y presupuesto */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fecha_inicio">Inicio estimado</Label>
              <Input
                id="fecha_inicio" type="date"
                value={form.fecha_inicio_est ?? ""}
                onChange={(e) => setForm(f => ({ ...f, fecha_inicio_est: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fecha_fin">Fin estimado</Label>
              <Input
                id="fecha_fin" type="date"
                value={form.fecha_fin_est ?? ""}
                onChange={(e) => setForm(f => ({ ...f, fecha_fin_est: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="presupuesto">Presupuesto ($)</Label>
              <Input
                id="presupuesto" type="number" min="0" step="0.01"
                value={form.presupuesto ?? 0}
                onChange={(e) => setForm(f => ({ ...f, presupuesto: parseFloat(e.target.value) || 0 }))}
              />
            </div>
          </div>

          {/* Jefe de obra */}
          <div className="space-y-2">
            <Label>Jefe de obra</Label>
            <Select
              value={form.jefe_obra_id ?? ""}
              onValueChange={(v) => setForm(f => ({ ...f, jefe_obra_id: v || null }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="— sin asignar —" />
              </SelectTrigger>
              <SelectContent>
                {jefesPosibles.map(u => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nombre} ({u.area})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Técnicos asignados */}
          <div className="space-y-2">
            <Label>Técnicos asignados</Label>
            <div className="flex flex-wrap gap-2 p-3 bg-secondary/30 border border-input rounded-md min-h-[60px]">
              {tecnicos.length === 0 ? (
                <span className="text-sm text-muted-foreground">No hay técnicos registrados</span>
              ) : (
                tecnicos.map(t => {
                  const checked = form.tecnicos_ids?.includes(t.id);
                  return (
                    <label
                      key={t.id}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer transition-colors text-sm ${
                        checked
                          ? "bg-primary text-primary-foreground"
                          : "bg-background hover:bg-accent"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked ?? false}
                        onChange={() => toggleTecnico(t.id)}
                        className="sr-only"
                      />
                      {t.nombre}
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Observaciones */}
          <div className="space-y-2">
            <Label htmlFor="obs">Observaciones</Label>
            <Textarea
              id="obs"
              rows={2}
              value={form.observaciones ?? ""}
              onChange={(e) => setForm(f => ({ ...f, observaciones: e.target.value }))}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Guardar cambios" : "Crear obra"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
