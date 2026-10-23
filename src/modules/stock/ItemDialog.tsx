import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
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
import { useCrearItem, useEditarItem } from "./useInventario";
import { useProveedores } from "@/modules/crm/proveedores/useProveedores";
import { useAuth } from "@/lib/auth";
import { puedeVerPrecios as canViewPrices } from "@/lib/permissions";
import { itemSchema, type ItemFormValues } from "./schemas";
import type { Inventario, CategoriaItem } from "@/types/database";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: Inventario | null;
}

const empty: ItemFormValues = {
  descripcion: "",
  categoria: "Material",
  unidad: "ud.",
  stock_inicial: 0,
  stock_minimo: 0,
  numero_serie: "",
  codigo_barras: "",
  proveedor_principal_id: null,
  precio_costo: 0,
  precio_lista: 0,
  ubicacion_fisica: "",
};

const CATEGORIAS: CategoriaItem[] = [
  "Material", "Consumo", "Herramienta", "Reutilizable", "Equipo especial",
];

import { UNIDADES } from "@/lib/unidades";

export function ItemDialog({ open, onOpenChange, item }: Props) {
  const isEdit = !!item;
  const { profile } = useAuth();
  const { data: proveedores = [] } = useProveedores();
  const crear = useCrearItem();
  const editar = useEditarItem();

  const puedeVerPrecios = canViewPrices(profile?.area);

  const [form, setForm] = useState<ItemFormValues>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (item) {
      setForm({
        descripcion: item.descripcion,
        categoria: item.categoria,
        unidad: item.unidad,
        stock_inicial: undefined,
        stock_minimo: item.stock_minimo,
        numero_serie: item.numero_serie ?? "",
        codigo_barras: item.codigo_barras ?? "",
        proveedor_principal_id: item.proveedor_principal_id,
        precio_costo: item.precio_costo,
        precio_lista: item.precio_lista,
        ubicacion_fisica: item.ubicacion_fisica ?? "",
      });
    } else if (open) {
      setForm(empty);
    }
    setErrors({});
  }, [item, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = itemSchema.safeParse(form);
    const errs: Record<string, string> = {};
    if (!parsed.success) {
      parsed.error.issues.forEach(i => { errs[i.path.join(".")] ??= i.message; });
    }
    // El costo solo lo carga quien puede ver precios
    if (puedeVerPrecios && !((form.precio_costo ?? 0) > 0)) {
      errs["precio_costo"] = "Precio de costo requerido";
    }
    if (!parsed.success || Object.keys(errs).length > 0) {
      setErrors(errs);
      toast.error("Completá los campos obligatorios");
      return;
    }
    setErrors({});
    try {
      if (isEdit && item) {
        await editar.mutateAsync({
          id: item.id,
          patch: {
            descripcion: parsed.data.descripcion,
            categoria: parsed.data.categoria,
            unidad: parsed.data.unidad,
            stock_minimo: parsed.data.stock_minimo ?? 0,
            numero_serie: parsed.data.numero_serie || null,
            codigo_barras: parsed.data.codigo_barras?.trim() || null,
            proveedor_principal_id: parsed.data.proveedor_principal_id,
            precio_costo: parsed.data.precio_costo ?? 0,
            precio_lista: parsed.data.precio_lista ?? 0,
            ubicacion_fisica: parsed.data.ubicacion_fisica?.trim() || null,
          },
        });
        toast.success("Ítem actualizado");
      } else {
        const it = await crear.mutateAsync({
          descripcion: parsed.data.descripcion,
          categoria: parsed.data.categoria,
          unidad: parsed.data.unidad,
          stock_inicial: parsed.data.stock_inicial,
          stock_minimo: parsed.data.stock_minimo,
          numero_serie: parsed.data.numero_serie || null,
          codigo_barras: parsed.data.codigo_barras?.trim() || null,
          proveedor_principal_id: parsed.data.proveedor_principal_id ?? null,
          precio_costo: parsed.data.precio_costo,
          precio_lista: parsed.data.precio_lista,
          ubicacion_fisica: parsed.data.ubicacion_fisica?.trim() || null,
        });
        toast.success(`Ítem ${it.item_id} creado`);
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
          <DialogTitle>{isEdit ? `Editar — ${item?.item_id}` : "Nuevo ítem"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Modificar los datos del ítem (stock se ajusta por separado)" : "Cargar un nuevo ítem al inventario"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción *</Label>
            <Input
              id="descripcion"
              value={form.descripcion}
              onChange={(e) => setForm(f => ({ ...f, descripcion: e.target.value }))}
              className={errors["descripcion"] ? "border-destructive" : ""}
              autoFocus
              placeholder="Ej: Fusionadora Fujikura FSM-80S"
            />
            {errors["descripcion"] && <p className="text-sm text-destructive">{errors["descripcion"]}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Categoría *</Label>
              <Select
                value={form.categoria}
                onValueChange={(v: any) => setForm(f => ({ ...f, categoria: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Unidad *</Label>
              <Select
                value={form.unidad}
                onValueChange={(v) => setForm(f => ({ ...f, unidad: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIDADES.map(u => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock_minimo">Stock mínimo</Label>
              <Input
                id="stock_minimo"
                type="number"
                min="0"
                step="0.01"
                value={form.stock_minimo || ""}
                onChange={(e) => setForm(f => ({ ...f, stock_minimo: parseFloat(e.target.value) || 0 }))}
              />
            </div>
          </div>

          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="stock_inicial">Stock inicial</Label>
              <Input
                id="stock_inicial"
                type="number"
                min="0"
                step="0.01"
                value={form.stock_inicial || ""}
                onChange={(e) => setForm(f => ({ ...f, stock_inicial: parseFloat(e.target.value) || 0 }))}
              />
              <p className="text-xs text-muted-foreground">
                Cantidad disponible al momento de crear el ítem (se registra como movimiento "Ingreso inicial")
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numero_serie">
                Número de serie{form.categoria === "Equipo especial" ? " *" : ""}
              </Label>
              <Input
                id="numero_serie"
                placeholder="Ej: DSX#0092"
                value={form.numero_serie ?? ""}
                onChange={(e) => setForm(f => ({ ...f, numero_serie: e.target.value }))}
                className={errors["numero_serie"] ? "border-destructive" : ""}
              />
              {errors["numero_serie"] && <p className="text-sm text-destructive">{errors["numero_serie"]}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ubicacion_fisica">Ubicación en pañol *</Label>
              <Input
                id="ubicacion_fisica"
                placeholder="Ej: AB-105, Estante 3, Caja 12"
                value={form.ubicacion_fisica ?? ""}
                onChange={(e) => setForm(f => ({ ...f, ubicacion_fisica: e.target.value }))}
                maxLength={50}
                className={errors["ubicacion_fisica"] ? "border-destructive" : ""}
              />
              {errors["ubicacion_fisica"] && <p className="text-sm text-destructive">{errors["ubicacion_fisica"]}</p>}
              <p className="text-[10px] text-muted-foreground">
                Para que los técnicos sepan dónde encontrarlo físicamente
              </p>
            </div>
          </div>

          {/* Código de barras (escaneable con lectora) */}
          <div className="space-y-2">
            <Label htmlFor="codigo_barras" className="flex items-center gap-1.5">
              📷 Código de barras <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Input
              id="codigo_barras"
              placeholder="Escaneá con la lectora o escribí el código"
              value={form.codigo_barras ?? ""}
              onChange={(e) => setForm(f => ({ ...f, codigo_barras: e.target.value }))}
              autoComplete="off"
            />
            <p className="text-[10px] text-muted-foreground">
              Poné el cursor acá y escaneá con la lectora Honeywell, o escribí un código propio. Sirve para buscar y cargar el item rápido.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Proveedor principal *</Label>
              <Select
                value={form.proveedor_principal_id ?? ""}
                onValueChange={(v) => setForm(f => ({ ...f, proveedor_principal_id: v || null }))}
              >
                <SelectTrigger className={errors["proveedor_principal_id"] ? "border-destructive" : ""}>
                  <SelectValue placeholder="Seleccionar proveedor..." />
                </SelectTrigger>
                <SelectContent>
                  {proveedores.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                  ))}
                  {proveedores.length === 0 && (
                    <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                      No hay proveedores. Cargalos en CRM → Proveedores.
                    </div>
                  )}
                </SelectContent>
              </Select>
              {errors["proveedor_principal_id"] && (
                <p className="text-sm text-destructive">{errors["proveedor_principal_id"]}</p>
              )}
            </div>
          </div>

          {puedeVerPrecios && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="precio_costo">Precio costo ($) *</Label>
                <Input
                  id="precio_costo"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={form.precio_costo || ""}
                  onChange={(e) => setForm(f => ({ ...f, precio_costo: parseFloat(e.target.value) || 0 }))}
                  className={errors["precio_costo"] ? "border-destructive" : ""}
                />
                {errors["precio_costo"] && <p className="text-sm text-destructive">{errors["precio_costo"]}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="precio_lista">
                  Precio lista ($) <span className="text-xs text-muted-foreground font-normal">(si se revende)</span>
                </Label>
                <Input
                  id="precio_lista"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.precio_lista || ""}
                  onChange={(e) => setForm(f => ({ ...f, precio_lista: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Guardar cambios" : "Crear ítem"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
