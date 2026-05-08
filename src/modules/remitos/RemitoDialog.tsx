import { useState, useEffect } from "react";
import { Loader2, AlertCircle, Package, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  useCrearRemito, useEditarRemito, useItemsRemitables,
} from "./useRemitos";
import { useObras } from "@/modules/obras/useObras";
import { cn, formatDate } from "@/lib/utils";
import type { RemitoConRelaciones } from "@/types/database";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  remito?: RemitoConRelaciones | null; // si viene → edición
  obraIdFijo?: string;
}

export function RemitoDialog({ open, onOpenChange, remito, obraIdFijo }: Props) {
  const isEdit = !!remito;
  const { data: obras = [] } = useObras();
  const crear = useCrearRemito();
  const editar = useEditarRemito();

  const [obraId, setObraId] = useState<string>(obraIdFijo ?? "");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [observaciones, setObservaciones] = useState("");
  const [recibidoPor, setRecibidoPor] = useState("");
  const [dniReceptor, setDniReceptor] = useState("");
  const [fechaRecepcion, setFechaRecepcion] = useState("");
  // Para creación: items seleccionados (ids de movimiento)
  const [itemsSeleccionados, setItemsSeleccionados] = useState<Set<string>>(new Set());

  // Filtros para items remitables
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todos");

  const { data: itemsRemitables = [] } = useItemsRemitables(
    !isEdit ? obraId || null : null
  );

  useEffect(() => {
    if (open) {
      if (remito) {
        // Edición - solo permite cambiar campos del remito (no items)
        setObraId(remito.obra_id);
        setFecha(remito.fecha.slice(0, 10));
        setObservaciones(remito.observaciones ?? "");
        setRecibidoPor(remito.recibido_por ?? "");
        setDniReceptor(remito.dni_receptor ?? "");
        setFechaRecepcion(remito.fecha_recepcion?.slice(0, 10) ?? "");
      } else {
        setObraId(obraIdFijo ?? "");
        setFecha(new Date().toISOString().slice(0, 10));
        setObservaciones("");
        setRecibidoPor("");
        setDniReceptor("");
        setFechaRecepcion("");
        setItemsSeleccionados(new Set());
        setFiltroCategoria("todos");
      }
    }
  }, [open, remito, obraIdFijo]);

  const itemsFiltrados = itemsRemitables.filter(it => {
    if (filtroCategoria === "todos") return true;
    if (filtroCategoria === "consumibles") return ["Material", "Consumo"].includes(it.categoria);
    if (filtroCategoria === "herramientas") return ["Herramienta", "Reutilizable", "Equipo especial"].includes(it.categoria);
    return it.categoria === filtroCategoria;
  });

  const toggleItem = (movimientoId: string) => {
    const next = new Set(itemsSeleccionados);
    if (next.has(movimientoId)) next.delete(movimientoId);
    else next.add(movimientoId);
    setItemsSeleccionados(next);
  };

  const seleccionarTodos = () => {
    setItemsSeleccionados(new Set(itemsFiltrados.map(it => it.movimiento_id)));
  };

  const limpiarSeleccion = () => {
    setItemsSeleccionados(new Set());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!obraId) {
      toast.error("Seleccioná una obra");
      return;
    }

    try {
      if (isEdit && remito) {
        await editar.mutateAsync({
          id: remito.id,
          patch: {
            fecha,
            observaciones: observaciones || null,
            recibido_por: recibidoPor || null,
            dni_receptor: dniReceptor || null,
            fecha_recepcion: fechaRecepcion || null,
          },
        });
        toast.success(`Remito ${remito.remito_id} actualizado`);
      } else {
        if (itemsSeleccionados.size === 0) {
          toast.error("Seleccioná al menos un ítem");
          return;
        }
        const itemsACrear = itemsRemitables
          .filter(it => itemsSeleccionados.has(it.movimiento_id))
          .map(it => ({
            item_id: it.item_id,
            movimiento_id: it.movimiento_id,
            cantidad: Number(it.cantidad),
            observaciones: null,
          }));
        const rem = await crear.mutateAsync({
          obra_id: obraId,
          fecha,
          observaciones: observaciones || null,
          recibido_por: recibidoPor || null,
          dni_receptor: dniReceptor || null,
          fecha_recepcion: fechaRecepcion || null,
          items: itemsACrear,
        });
        toast.success(`Remito ${rem.remito_id} creado con ${itemsACrear.length} ítems`);
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  const obrasActivas = obras.filter(o =>
    ["Pendiente OIO", "En ejecucion", "Para cierre", "Cerrada"].includes(o.estado)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Editar remito ${remito?.remito_id}` : "Nuevo remito"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modificar datos del remito (los ítems no se pueden editar después de crear)"
              : "Crear un remito de entrega al cliente"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Obra *</Label>
              <Select value={obraId} onValueChange={setObraId} disabled={isEdit || !!obraIdFijo}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar obra..." />
                </SelectTrigger>
                <SelectContent>
                  {obrasActivas.map(o => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.obra_id} — {o.nombre_obra ?? o.cliente?.nombre ?? "Sin nombre"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fecha *</Label>
              <Input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
          </div>

          {/* Selección de ítems (solo en creación) */}
          {!isEdit && obraId && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                  <div>
                    <h3 className="text-sm font-semibold">Ítems entregados disponibles</h3>
                    <p className="text-xs text-muted-foreground">
                      {itemsRemitables.length} retiros sin remitir
                      {itemsSeleccionados.size > 0 && (
                        <span className="text-primary font-semibold">
                          {" "}· {itemsSeleccionados.size} seleccionados
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                      <SelectTrigger className="w-[160px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todas las categorías</SelectItem>
                        <SelectItem value="consumibles">Solo consumibles</SelectItem>
                        <SelectItem value="herramientas">Solo herramientas</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="ghost" size="sm" onClick={seleccionarTodos}>
                      Seleccionar todos
                    </Button>
                    {itemsSeleccionados.size > 0 && (
                      <Button type="button" variant="ghost" size="sm" onClick={limpiarSeleccion}>
                        Limpiar
                      </Button>
                    )}
                  </div>
                </div>

                {itemsRemitables.length === 0 ? (
                  <div className="rounded-md bg-secondary/50 p-4 text-sm text-muted-foreground flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>
                      No hay ítems sin remitir en esta obra. Todos los retiros ya fueron incluidos en remitos anteriores
                      o la obra todavía no tiene retiros.
                    </span>
                  </div>
                ) : itemsFiltrados.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    Sin resultados con ese filtro
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-72 overflow-y-auto">
                    {itemsFiltrados.map(it => {
                      const seleccionado = itemsSeleccionados.has(it.movimiento_id);
                      const esConsumible = ["Material", "Consumo"].includes(it.categoria);
                      return (
                        <label
                          key={it.movimiento_id}
                          className={cn(
                            "flex items-start gap-3 cursor-pointer p-2 rounded-md transition-colors border",
                            seleccionado
                              ? "bg-primary/10 border-primary/40"
                              : "border-border hover:bg-accent/50"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={seleccionado}
                            onChange={() => toggleItem(it.movimiento_id)}
                            className="mt-1 h-4 w-4 cursor-pointer accent-primary flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{it.descripcion}</span>
                              <span className="text-[10px] text-muted-foreground">{it.item_codigo}</span>
                              <span className={cn(
                                "px-1.5 py-0.5 rounded text-[9px] font-semibold",
                                esConsumible ? "bg-green-500/15 text-green-400" : "bg-purple-500/15 text-purple-400"
                              )}>
                                {it.categoria}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                              <span><b>{Number(it.cantidad)}</b> {it.unidad}</span>
                              <span>· {formatDate(it.fecha)}</span>
                              {it.tecnico_nombre && <span>· {it.tecnico_nombre}</span>}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Datos del receptor */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Datos de recepción (opcional)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Recibido por</Label>
                <Input
                  placeholder="Nombre completo"
                  value={recibidoPor}
                  onChange={(e) => setRecibidoPor(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">DNI</Label>
                <Input
                  placeholder="12.345.678"
                  value={dniReceptor}
                  onChange={(e) => setDniReceptor(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha de recepción</Label>
                <Input
                  type="date"
                  value={fechaRecepcion}
                  onChange={(e) => setFechaRecepcion(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Si no completás estos datos ahora, podés exportar la versión "para firmar" y completarlos después.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Observaciones</Label>
            <Textarea
              rows={2}
              placeholder="Detalles, condiciones especiales..."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={crear.isPending || editar.isPending}>
              {(crear.isPending || editar.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Guardar cambios" : "Crear remito"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
