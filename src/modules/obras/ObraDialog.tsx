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
import { useClientes } from "./useClientes";
import { ClienteDialog } from "@/modules/crm/clientes/ClienteDialog";
import { useUsuarios, useTecnicos } from "./useUsuarios";
import { useCrearObra, useEditarObra } from "./useObras";
import { obraSchema, type ObraFormValues } from "./schemas";
import { AvisarWhatsAppDialog } from "./AvisarWhatsAppDialog";
import { useAuth } from "@/lib/auth";
import { puedeVerPrecios } from "@/lib/permissions";
import type { ObraParaAviso } from "@/lib/whatsapp";
import type { Obra, ObraConRelaciones, Usuario } from "@/types/database";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  obra?: ObraConRelaciones | null; // si viene, es edición
}

export function ObraDialog({ open, onOpenChange, obra }: Props) {
  const isEdit = !!obra;
  const { profile } = useAuth();
  const verPrecios = puedeVerPrecios(profile?.area);
  const { data: clientes = [] } = useClientes();
  const { data: jefesPosibles = [] } = useUsuarios(["Direccion", "Operaciones", "Tecnico"]);
  const { data: tecnicos = [] } = useTecnicos();
  const crearObra = useCrearObra();
  const editarObra = useEditarObra();

  const [form, setForm] = useState<ObraFormValues>({
    cliente_id: null,
    nombre_obra: "",
    sitio: "",
    alcance_tecnico: "",
    maps_url: "",
    fecha_inicio_est: "",
    fecha_fin_est: "",
    presupuesto: 0,
    jefe_obra_id: null,
    observaciones: "",
    tecnicos_ids: [],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [nuevoClienteOpen, setNuevoClienteOpen] = useState(false);
  // Aviso por WhatsApp a los técnicos recién asignados (se abre al guardar)
  const [aviso, setAviso] = useState<{ obra: ObraParaAviso; tecnicos: Usuario[] } | null>(null);

  useEffect(() => {
    if (obra) {
      setForm({
        cliente_id: obra.cliente_id,
        nombre_obra: obra.nombre_obra ?? "",
        sitio: obra.sitio ?? "",
        alcance_tecnico: obra.alcance_tecnico ?? "",
        maps_url: obra.maps_url ?? "",
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
        maps_url: "",
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
    const errs: Record<string, string> = {};
    if (!parsed.success) {
      parsed.error.issues.forEach(i => { errs[i.path.join(".")] ??= i.message; });
    }
    // El presupuesto solo lo carga quien puede ver precios
    if (verPrecios && !((form.presupuesto ?? 0) > 0)) {
      errs["presupuesto"] = "Presupuesto requerido";
    }
    if (!parsed.success || Object.keys(errs).length > 0) {
      setErrors(errs);
      toast.error("Completá los campos obligatorios");
      return;
    }
    setErrors({});
    // Solo se avisa a los técnicos que no estaban asignados antes
    const yaAsignados = new Set(obra?.tecnicos?.map(t => t.id) ?? []);
    const nuevosTecnicos = tecnicos.filter(
      t => parsed.data.tecnicos_ids?.includes(t.id) && !yaAsignados.has(t.id),
    );
    const prepararAviso = (o: Obra) => {
      if (nuevosTecnicos.length === 0) return;
      setAviso({
        obra: {
          ...o,
          cliente_nombre: clientes.find(c => c.id === o.cliente_id)?.nombre ?? null,
          jefe_nombre: jefesPosibles.find(u => u.id === o.jefe_obra_id)?.nombre ?? null,
        },
        tecnicos: nuevosTecnicos,
      });
    };

    try {
      if (isEdit && obra) {
        const obraEditada = await editarObra.mutateAsync({
          id: obra.id,
          patch: {
            cliente_id: parsed.data.cliente_id,
            nombre_obra: parsed.data.nombre_obra,
            sitio: parsed.data.sitio ?? null,
            alcance_tecnico: parsed.data.alcance_tecnico ?? null,
            maps_url: parsed.data.maps_url?.trim() || null,
            fecha_inicio_est: parsed.data.fecha_inicio_est || null,
            fecha_fin_est: parsed.data.fecha_fin_est || null,
            presupuesto: parsed.data.presupuesto ?? 0,
            jefe_obra_id: parsed.data.jefe_obra_id ?? null,
            observaciones: parsed.data.observaciones ?? null,
          },
          tecnicos_ids: parsed.data.tecnicos_ids,
        });
        toast.success("Obra actualizada");
        prepararAviso(obraEditada);
      } else {
        const obraNueva = await crearObra.mutateAsync({
          cliente_id: parsed.data.cliente_id,
          nombre_obra: parsed.data.nombre_obra,
          sitio: parsed.data.sitio,
          alcance_tecnico: parsed.data.alcance_tecnico,
          maps_url: parsed.data.maps_url?.trim() || null,
          fecha_inicio_est: parsed.data.fecha_inicio_est || null,
          fecha_fin_est: parsed.data.fecha_fin_est || null,
          presupuesto: parsed.data.presupuesto,
          jefe_obra_id: parsed.data.jefe_obra_id,
          observaciones: parsed.data.observaciones,
          tecnicos_ids: parsed.data.tecnicos_ids,
        });
        toast.success(`Obra ${obraNueva.obra_id} creada`);
        prepararAviso(obraNueva);
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  const loading = crearObra.isPending || editarObra.isPending;

  const ErrorCampo = ({ campo }: { campo: string }) =>
    errors[campo] ? <p className="text-sm text-destructive">{errors[campo]}</p> : null;

  return (
    <>
    <AvisarWhatsAppDialog
      open={!!aviso}
      onOpenChange={(o) => { if (!o) setAviso(null); }}
      obra={aviso?.obra ?? null}
      tecnicos={aviso?.tecnicos ?? []}
    />
    <ClienteDialog
      open={nuevoClienteOpen}
      onOpenChange={setNuevoClienteOpen}
      onCreated={(c) => setForm(f => ({ ...f, cliente_id: c.id }))}
    />
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
              {/* Abre el alta completa de cliente, para no crear clientes con datos vacíos */}
              <Button type="button" variant="outline" size="icon" title="Nuevo cliente" onClick={() => setNuevoClienteOpen(true)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <ErrorCampo campo="cliente_id" />
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
              <ErrorCampo campo="nombre_obra" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sitio">Sitio / dirección *</Label>
              <Input
                id="sitio"
                value={form.sitio ?? ""}
                onChange={(e) => setForm(f => ({ ...f, sitio: e.target.value }))}
                className={errors["sitio"] ? "border-destructive" : ""}
              />
              <ErrorCampo campo="sitio" />
            </div>
          </div>

          {/* Ubicación Google Maps (opcional) */}
          <div className="space-y-2">
            <Label htmlFor="maps_url" className="flex items-center gap-1.5">
              📍 Link de Google Maps <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Input
              id="maps_url"
              value={form.maps_url ?? ""}
              onChange={(e) => setForm(f => ({ ...f, maps_url: e.target.value }))}
              placeholder="Pegá el link de Google Maps de la ubicación"
            />
            <p className="text-[11px] text-muted-foreground">
              En Google Maps buscá la ubicación → Compartir → Copiar vínculo, y pegalo acá. Los técnicos verán un botón "Cómo llegar".
            </p>
            {form.maps_url && !/(google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(form.maps_url) && (
              <p className="text-[11px] text-warning">
                ⚠️ Esto no parece un link de Google Maps. Verificá que sea correcto.
              </p>
            )}
          </div>

          {/* Alcance */}
          <div className="space-y-2">
            <Label htmlFor="alcance">Alcance técnico *</Label>
            <Textarea
              id="alcance"
              rows={3}
              value={form.alcance_tecnico ?? ""}
              onChange={(e) => setForm(f => ({ ...f, alcance_tecnico: e.target.value }))}
              placeholder="Descripción de los trabajos..."
              className={errors["alcance_tecnico"] ? "border-destructive" : ""}
            />
            <ErrorCampo campo="alcance_tecnico" />
          </div>

          {/* Fechas y presupuesto */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fecha_inicio">Inicio estimado *</Label>
              <Input
                id="fecha_inicio" type="date"
                value={form.fecha_inicio_est ?? ""}
                onChange={(e) => setForm(f => ({ ...f, fecha_inicio_est: e.target.value }))}
                className={errors["fecha_inicio_est"] ? "border-destructive" : ""}
              />
              <ErrorCampo campo="fecha_inicio_est" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fecha_fin">Fin estimado *</Label>
              <Input
                id="fecha_fin" type="date"
                min={form.fecha_inicio_est || undefined}
                value={form.fecha_fin_est ?? ""}
                onChange={(e) => setForm(f => ({ ...f, fecha_fin_est: e.target.value }))}
                className={errors["fecha_fin_est"] ? "border-destructive" : ""}
              />
              <ErrorCampo campo="fecha_fin_est" />
            </div>
            {verPrecios && (
              <div className="space-y-2">
                <Label htmlFor="presupuesto">Presupuesto ($) *</Label>
                <Input
                  id="presupuesto" type="number" min="0" step="0.01" placeholder="0,00"
                  value={form.presupuesto || ""}
                  onChange={(e) => setForm(f => ({ ...f, presupuesto: parseFloat(e.target.value) || 0 }))}
                  className={errors["presupuesto"] ? "border-destructive" : ""}
                />
                <ErrorCampo campo="presupuesto" />
              </div>
            )}
          </div>

          {/* Jefe de obra */}
          <div className="space-y-2">
            <Label>Jefe de obra *</Label>
            <Select
              value={form.jefe_obra_id ?? ""}
              onValueChange={(v) => setForm(f => ({ ...f, jefe_obra_id: v || null }))}
            >
              <SelectTrigger className={errors["jefe_obra_id"] ? "border-destructive" : ""}>
                <SelectValue placeholder="Seleccionar jefe de obra..." />
              </SelectTrigger>
              <SelectContent>
                {jefesPosibles.map(u => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nombre} ({u.area})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ErrorCampo campo="jefe_obra_id" />
          </div>

          {/* Técnicos asignados */}
          <div className="space-y-2">
            <Label>Técnicos asignados *</Label>
            <div className={`flex flex-wrap gap-2 p-3 bg-secondary/30 border rounded-md min-h-[60px] ${
              errors["tecnicos_ids"] ? "border-destructive" : "border-input"
            }`}>
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
            <ErrorCampo campo="tecnicos_ids" />
          </div>

          {/* Observaciones */}
          <div className="space-y-2">
            <Label htmlFor="obs">
              Observaciones <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
            </Label>
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
    </>
  );
}
