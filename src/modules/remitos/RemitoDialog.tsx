import { useState, useEffect } from "react";
import { Loader2, AlertCircle, Plus, Trash2, Briefcase, User } from "lucide-react";
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
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  useCrearRemito, useEditarRemito, useItemsRemitables,
  useEditarRemitoItem, useEliminarRemitoItem, useAgregarRemitoItem,
} from "./useRemitos";
import { useObras } from "@/modules/obras/useObras";
import { useClientes } from "@/modules/crm/clientes/useClientes";
import { useInventario } from "@/modules/stock/useInventario";
import { useAuth } from "@/lib/auth";
import { cn, formatDate } from "@/lib/utils";
import type { RemitoConRelaciones } from "@/types/database";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  remito?: RemitoConRelaciones | null;
  obraIdFijo?: string;
}

type ModoRemito = "obra" | "directo";

// Item draft para modo directo (sin obra)
type ItemDraft = {
  item_id: string | null;
  descripcion_libre: string;
  cantidad: number;
  unidad: string;
};

export function RemitoDialog({ open, onOpenChange, remito, obraIdFijo }: Props) {
  const isEdit = !!remito;
  const { profile } = useAuth();
  const puedeEditarItems = profile && ["Direccion", "Operaciones", "Contabilidad", "Comercial", "Paniol"].includes(profile.area);
  const { data: obras = [] } = useObras();
  const { data: clientes = [] } = useClientes();
  const { data: inventario = [] } = useInventario();
  const crear = useCrearRemito();
  const editar = useEditarRemito();
  const editarItem = useEditarRemitoItem();
  const eliminarItem = useEliminarRemitoItem();
  const agregarItem = useAgregarRemitoItem();

  const [modo, setModo] = useState<ModoRemito>(obraIdFijo ? "obra" : "obra");
  const [obraId, setObraId] = useState<string>(obraIdFijo ?? "");
  const [clienteDirectoId, setClienteDirectoId] = useState<string>("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [observaciones, setObservaciones] = useState("");
  const [recibidoPor, setRecibidoPor] = useState("");
  const [dniReceptor, setDniReceptor] = useState("");
  const [fechaRecepcion, setFechaRecepcion] = useState("");
  const [descontarStock, setDescontarStock] = useState(true);

  // Modo "obra": items pre-existentes seleccionables
  const [itemsSeleccionados, setItemsSeleccionados] = useState<Set<string>>(new Set());
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todos");

  // Modo "directo": items libres
  const [itemsDraft, setItemsDraft] = useState<ItemDraft[]>([
    { item_id: null, descripcion_libre: "", cantidad: 1, unidad: "ud." },
  ]);
  const [scanInput, setScanInput] = useState("");

  const { data: itemsRemitables = [] } = useItemsRemitables(
    !isEdit && modo === "obra" ? (obraId || null) : null
  );

  useEffect(() => {
    if (open) {
      if (remito) {
        // Edición: solo cambiar campos del remito (los items no se editan)
        setModo(remito.obra_id ? "obra" : "directo");
        setObraId(remito.obra_id ?? "");
        setClienteDirectoId(remito.cliente_id ?? "");
        setFecha(remito.fecha.slice(0, 10));
        setObservaciones(remito.observaciones ?? "");
        setRecibidoPor(remito.recibido_por ?? "");
        setDniReceptor(remito.dni_receptor ?? "");
        setFechaRecepcion(remito.fecha_recepcion?.slice(0, 10) ?? "");
      } else {
        setModo(obraIdFijo ? "obra" : "obra");
        setObraId(obraIdFijo ?? "");
        setClienteDirectoId("");
        setFecha(new Date().toISOString().slice(0, 10));
        setObservaciones("");
        setRecibidoPor("");
        setDniReceptor("");
        setFechaRecepcion("");
        setDescontarStock(true);
        setItemsSeleccionados(new Set());
        setFiltroCategoria("todos");
        setItemsDraft([{ item_id: null, descripcion_libre: "", cantidad: 1, unidad: "ud." }]);
      }
    }
  }, [open, remito, obraIdFijo]);

  // ============ ACCIONES MODO OBRA ============
  const itemsFiltrados = itemsRemitables.filter(it => {
    if (filtroCategoria === "todos") return true;
    if (filtroCategoria === "consumibles") return ["Material", "Consumo"].includes(it.categoria);
    if (filtroCategoria === "herramientas") return ["Herramienta", "Reutilizable", "Equipo especial"].includes(it.categoria);
    return it.categoria === filtroCategoria;
  });

  const toggleItem = (movId: string) => {
    const next = new Set(itemsSeleccionados);
    if (next.has(movId)) next.delete(movId);
    else next.add(movId);
    setItemsSeleccionados(next);
  };

  // ============ ACCIONES MODO DIRECTO ============
  const addItemDirecto = () => {
    setItemsDraft([...itemsDraft, { item_id: null, descripcion_libre: "", cantidad: 1, unidad: "ud." }]);
  };

  const removeItemDirecto = (idx: number) => {
    if (itemsDraft.length === 1) return;
    setItemsDraft(itemsDraft.filter((_, i) => i !== idx));
  };

  const updateItemDirecto = (idx: number, patch: Partial<ItemDraft>) => {
    setItemsDraft(itemsDraft.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };

  const onSeleccionItemDirecto = (idx: number, value: string) => {
    if (value === "manual") {
      updateItemDirecto(idx, { item_id: null });
    } else {
      const inv = inventario.find(i => i.id === value);
      updateItemDirecto(idx, {
        item_id: value,
        descripcion_libre: "",
        unidad: inv?.unidad ?? "ud.",
      });
    }
  };

  // Escaneo con lectora: busca por código de barras y agrega/incrementa el item
  const onEscanearCodigo = (codigo: string) => {
    const cod = codigo.trim();
    if (!cod) return;
    const inv = inventario.find(i => i.codigo_barras && i.codigo_barras.trim() === cod);
    if (!inv) {
      toast.error(`Código "${cod}" no encontrado en el inventario`);
      return;
    }
    // ¿Ya está en la lista? → incrementar cantidad
    const existenteIdx = itemsDraft.findIndex(it => it.item_id === inv.id);
    if (existenteIdx >= 0) {
      updateItemDirecto(existenteIdx, { cantidad: itemsDraft[existenteIdx].cantidad + 1 });
      toast.success(`${inv.descripcion} +1 (${itemsDraft[existenteIdx].cantidad + 1})`);
    } else {
      // Si la última fila está vacía, usarla; si no, agregar nueva
      const ultimaVacia = itemsDraft.length > 0 &&
        !itemsDraft[itemsDraft.length - 1].item_id &&
        !itemsDraft[itemsDraft.length - 1].descripcion_libre.trim();
      if (ultimaVacia) {
        updateItemDirecto(itemsDraft.length - 1, {
          item_id: inv.id, descripcion_libre: "", unidad: inv.unidad ?? "ud.", cantidad: 1,
        });
      } else {
        setItemsDraft(prev => [...prev, {
          item_id: inv.id, descripcion_libre: "", cantidad: 1, unidad: inv.unidad ?? "ud.",
        }]);
      }
      toast.success(`${inv.descripcion} agregado`);
    }
  };

  // ============ SUBMIT ============
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (isEdit && remito) {
        // SOLO EDITAR datos (no items, no modo)
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
        // CREAR según modo
        if (modo === "obra") {
          if (!obraId) {
            toast.error("Seleccioná una obra");
            return;
          }
          if (itemsSeleccionados.size === 0) {
            toast.error("Seleccioná al menos un ítem");
            return;
          }
          const itemsACrear = itemsRemitables
            .filter(it => itemsSeleccionados.has(it.movimiento_id))
            .map(it => ({
              item_id: it.item_id,
              descripcion_libre: null,
              movimiento_id: it.movimiento_id,
              cantidad: Number(it.cantidad),
              unidad: it.unidad,
              observaciones: null,
            }));

          const rem = await crear.mutateAsync({
            obra_id: obraId,
            cliente_id: null,
            fecha,
            observaciones: observaciones || null,
            recibido_por: recibidoPor || null,
            dni_receptor: dniReceptor || null,
            fecha_recepcion: fechaRecepcion || null,
            descontar_stock: false, // ya están descontados (vienen de retiros)
            items: itemsACrear,
          });
          toast.success(`Remito ${rem.remito_id} creado con ${itemsACrear.length} ítems`);
        } else {
          // MODO DIRECTO
          if (!clienteDirectoId) {
            toast.error("Seleccioná un cliente");
            return;
          }
          const itemsValid = itemsDraft.filter(it =>
            (it.item_id || it.descripcion_libre.trim()) && it.cantidad > 0
          );
          if (itemsValid.length === 0) {
            toast.error("Agregá al menos un ítem válido");
            return;
          }

          // Validar stock si se va a descontar
          if (descontarStock) {
            for (const it of itemsValid) {
              if (!it.item_id) continue; // los manuales no se chequean
              const inv = inventario.find(i => i.id === it.item_id);
              if (inv && inv.stock_disponible < it.cantidad) {
                toast.error(`Stock insuficiente: ${inv.descripcion} (hay ${inv.stock_disponible}, se piden ${it.cantidad})`);
                return;
              }
            }
          }

          const rem = await crear.mutateAsync({
            obra_id: null,
            cliente_id: clienteDirectoId,
            fecha,
            observaciones: observaciones || null,
            recibido_por: recibidoPor || null,
            dni_receptor: dniReceptor || null,
            fecha_recepcion: fechaRecepcion || null,
            descontar_stock: descontarStock,
            items: itemsValid.map(it => ({
              item_id: it.item_id,
              descripcion_libre: it.item_id ? null : it.descripcion_libre,
              unidad: it.unidad,
              cantidad: it.cantidad,
              observaciones: null,
            })),
          });
          toast.success(`Remito ${rem.remito_id} creado con ${itemsValid.length} ítems`);
        }
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
          {/* Selector de modo (solo en creación, no en edición ni con obra fija) */}
          {!isEdit && !obraIdFijo && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setModo("obra")}
                className={cn(
                  "flex flex-col items-start gap-1 p-3 rounded-md border transition-colors text-left",
                  modo === "obra"
                    ? "bg-primary/10 border-primary/50"
                    : "border-border hover:bg-accent/50"
                )}
              >
                <div className="flex items-center gap-2">
                  <Briefcase className={cn("h-4 w-4", modo === "obra" ? "text-primary" : "text-muted-foreground")} />
                  <span className="text-sm font-medium">Desde obra</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Toma ítems de retiros realizados en una obra
                </span>
              </button>

              <button
                type="button"
                onClick={() => setModo("directo")}
                className={cn(
                  "flex flex-col items-start gap-1 p-3 rounded-md border transition-colors text-left",
                  modo === "directo"
                    ? "bg-primary/10 border-primary/50"
                    : "border-border hover:bg-accent/50"
                )}
              >
                <div className="flex items-center gap-2">
                  <User className={cn("h-4 w-4", modo === "directo" ? "text-primary" : "text-muted-foreground")} />
                  <span className="text-sm font-medium">Entrega directa</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Entrega de mercadería al cliente sin obra asociada
                </span>
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {modo === "obra" || isEdit ? (
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
            ) : (
              <div className="space-y-2">
                <Label>Cliente *</Label>
                <SearchableSelect
                  value={clienteDirectoId || null}
                  onChange={(v) => setClienteDirectoId(v ?? "")}
                  placeholder="Seleccionar cliente..."
                  options={clientes.map(c => ({
                    value: c.id,
                    label: c.nombre,
                    searchText: c.cuit ?? "",
                  }))}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Fecha *</Label>
              <Input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
          </div>

          {/* SECCIÓN DE ÍTEMS - solo en creación */}
          {!isEdit && (
            <>
              {/* MODO OBRA: lista de items remitables */}
              {modo === "obra" && obraId && (
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
                        <Button type="button" variant="ghost" size="sm" onClick={() => {
                          setItemsSeleccionados(new Set(itemsFiltrados.map(it => it.movimiento_id)));
                        }}>
                          Seleccionar todos
                        </Button>
                      </div>
                    </div>

                    {itemsRemitables.length === 0 ? (
                      <div className="rounded-md bg-secondary/50 p-4 text-sm text-muted-foreground flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <div>
                          <span>No hay ítems sin remitir en esta obra. </span>
                          <span className="block mt-1 text-xs">
                            💡 Si querés entregar otros ítems al cliente, usá el modo
                            <b> "Entrega directa"</b> arriba.
                          </span>
                        </div>
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
                                  <span className="text-sm font-medium break-words">{it.descripcion}</span>
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

              {/* MODO DIRECTO: items libres */}
              {modo === "directo" && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <h3 className="text-sm font-semibold">Ítems a entregar</h3>
                      <Button type="button" variant="outline" size="sm" onClick={addItemDirecto}>
                        <Plus className="h-3.5 w-3.5" /> Agregar ítem
                      </Button>
                    </div>

                    {/* Barra de escaneo con lectora */}
                    <div className="mb-3">
                      <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                        <span className="text-lg">📷</span>
                        <input
                          type="text"
                          placeholder="Escaneá un código de barras para agregar el item..."
                          value={scanInput}
                          onChange={(e) => setScanInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              onEscanearCodigo(scanInput);
                              setScanInput("");
                            }
                          }}
                          autoComplete="off"
                          className="flex-1 bg-transparent border-none outline-none text-sm"
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Poné el cursor acá y escaneá con la lectora. Si el item ya está en la lista, suma 1.
                      </p>
                    </div>

                    <div className="space-y-2">
                      {itemsDraft.map((draft, idx) => {
                        const inv = draft.item_id ? inventario.find(i => i.id === draft.item_id) : null;
                        const stockInsuf = descontarStock && inv && inv.stock_disponible < draft.cantidad;
                        return (
                          <div key={idx} className="rounded-md border bg-secondary/20 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-muted-foreground">Ítem #{idx + 1}</span>
                              {itemsDraft.length > 1 && (
                                <Button
                                  type="button" variant="ghost" size="icon"
                                  onClick={() => removeItemDirecto(idx)}
                                  className="h-7 w-7 text-destructive"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>

                            <SearchableSelect
                              value={draft.item_id ?? "manual"}
                              onChange={(v) => onSeleccionItemDirecto(idx, v ?? "manual")}
                              placeholder="Seleccionar del inventario..."
                              options={[
                                { value: "manual", label: "📝 Escribir descripción manual" },
                                ...inventario.map(it => ({
                                  value: it.id,
                                  label: it.descripcion,
                                  searchText: `${it.item_id}${it.numero_serie ? ` · S/N ${it.numero_serie}` : ""}`,
                                  hint: `${it.stock_disponible} disp.`,
                                })),
                              ]}
                            />

                            {draft.item_id === null && (
                              <Input
                                placeholder="Descripción del ítem..."
                                value={draft.descripcion_libre}
                                onChange={(e) => updateItemDirecto(idx, { descripcion_libre: e.target.value })}
                              />
                            )}

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-[10px]">Cantidad</Label>
                                <Input
                                  type="number"
                                  min="0.01" step="0.01"
                                  value={draft.cantidad}
                                  onChange={(e) => updateItemDirecto(idx, { cantidad: parseFloat(e.target.value) || 0 })}
                                  className={stockInsuf ? "border-destructive" : ""}
                                />
                              </div>
                              <div>
                                <Label className="text-[10px]">Unidad</Label>
                                <Input
                                  placeholder="ud., m, kg..."
                                  value={draft.unidad}
                                  onChange={(e) => updateItemDirecto(idx, { unidad: e.target.value })}
                                />
                              </div>
                            </div>

                            {stockInsuf && (
                              <div className="text-xs text-destructive flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Stock insuficiente: hay {inv?.stock_disponible} disp.
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Toggle descontar stock */}
                    <div className="mt-4 pt-3 border-t border-border/50">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={descontarStock}
                          onChange={(e) => setDescontarStock(e.target.checked)}
                          className="mt-0.5 h-4 w-4 cursor-pointer accent-primary"
                        />
                        <div>
                          <div className="text-sm font-medium break-words">Descontar del stock al crear</div>
                          <div className="text-xs text-muted-foreground">
                            {descontarStock
                              ? "✓ Genera movimientos de Retiro automáticamente para los ítems del inventario"
                              : "Solo registra el remito como documento, sin afectar el inventario"}
                          </div>
                        </div>
                      </label>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* === EN EDICIÓN: editar items existentes === */}
          {isEdit && remito && puedeEditarItems && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">Items del remito ({(remito.items ?? []).length})</h3>
                    <p className="text-xs text-muted-foreground">Modificar cantidades, descripciones o agregar/quitar items</p>
                  </div>
                </div>
                <RemitoItemsEditor
                  remitoId={remito.id}
                  items={(remito.items ?? []) as any[]}
                  inventario={inventario}
                  onEdit={(id, patch) => editarItem.mutateAsync({ id, patch })}
                  onDelete={(id) => eliminarItem.mutateAsync(id)}
                  onAdd={(args) => agregarItem.mutateAsync({ remito_id: remito.id, ...args })}
                />
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

/** Editor inline de items de un remito existente */
function RemitoItemsEditor({ remitoId: _remitoId, items, inventario, onEdit, onDelete, onAdd }: {
  remitoId: string;
  items: any[];
  inventario: any[];
  onEdit: (id: string, patch: any) => Promise<any>;
  onDelete: (id: string) => Promise<any>;
  onAdd: (args: any) => Promise<any>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCant, setEditCant] = useState<number>(0);
  const [editDesc, setEditDesc] = useState<string>("");
  const [editUnidad, setEditUnidad] = useState<string>("");
  const [agregando, setAgregando] = useState(false);
  const [newItemId, setNewItemId] = useState<string | null>(null);
  const [newDesc, setNewDesc] = useState("");
  const [newCant, setNewCant] = useState(1);
  const [newUnidad, setNewUnidad] = useState("ud.");

  const startEdit = (it: any) => {
    setEditingId(it.id);
    setEditCant(Number(it.cantidad));
    setEditDesc(it.descripcion_libre ?? "");
    setEditUnidad(it.unidad ?? "");
  };

  const saveEdit = async (id: string) => {
    try {
      await onEdit(id, {
        cantidad: editCant,
        descripcion_libre: editDesc || null,
        unidad: editUnidad || null,
      });
      toast.success("Item actualizado");
      setEditingId(null);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este item del remito?")) return;
    try {
      await onDelete(id);
      toast.success("Item eliminado");
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  const handleAdd = async () => {
    if (!newItemId && !newDesc.trim()) {
      toast.error("Elegí un item del catálogo o escribí descripción libre");
      return;
    }
    if (newCant <= 0) {
      toast.error("Cantidad debe ser mayor a 0");
      return;
    }
    try {
      const inv = inventario.find(i => i.id === newItemId);
      await onAdd({
        item_id: newItemId,
        descripcion_libre: newItemId ? null : newDesc,
        cantidad: newCant,
        unidad: inv?.unidad ?? newUnidad,
      });
      toast.success("Item agregado");
      setAgregando(false);
      setNewItemId(null);
      setNewDesc("");
      setNewCant(1);
      setNewUnidad("ud.");
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  return (
    <div className="space-y-2">
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-2">Sin items en este remito</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((it: any) => {
            const isEditing = editingId === it.id;
            const isLinked = !!it.movimiento_id; // Si está vinculado a un movimiento, no permitimos eliminar
            return (
              <div key={it.id} className="border rounded-md p-2 text-sm">
                {isEditing ? (
                  <div className="space-y-2">
                    <div className="text-xs font-medium">
                      {it.item?.descripcion ?? it.descripcion_libre ?? "—"}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-[10px]">Cantidad</Label>
                        <Input type="number" min="0.01" step="0.01"
                          value={editCant}
                          onChange={(e) => setEditCant(parseFloat(e.target.value) || 0)} />
                      </div>
                      <div>
                        <Label className="text-[10px]">Unidad</Label>
                        <Input value={editUnidad} onChange={(e) => setEditUnidad(e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-[10px]">Descripción libre</Label>
                        <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
                          placeholder={it.item?.descripcion ?? "—"} />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancelar</Button>
                      <Button type="button" size="sm" onClick={() => saveEdit(it.id)}>Guardar</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">
                        {it.item?.descripcion ?? it.descripcion_libre ?? "—"}
                      </span>
                      {isLinked && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-warning/15 text-warning border border-warning/30">
                          Vinculado a movimiento
                        </span>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {Number(it.cantidad)} {it.unidad ?? "ud."}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button type="button" variant="ghost" size="sm" onClick={() => startEdit(it)}>
                        Editar
                      </Button>
                      {!isLinked && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => handleDelete(it.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Agregar item nuevo */}
      {agregando ? (
        <div className="border-2 border-dashed rounded-md p-3 space-y-2 bg-muted/30">
          <Label className="text-xs">Agregar item</Label>
          <SearchableSelect
            value={newItemId}
            onChange={(v) => setNewItemId(v)}
            placeholder="Elegir del inventario (o dejá vacío y poné descripción libre)..."
            options={inventario.filter(i => i.activo).map(i => ({
              value: i.id,
              label: i.descripcion,
              searchText: i.item_id,
              hint: `${i.unidad}`,
            }))}
          />
          {!newItemId && (
            <Input
              placeholder="Descripción libre"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Cantidad</Label>
              <Input type="number" min="0.01" step="0.01"
                value={newCant}
                onChange={(e) => setNewCant(parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <Label className="text-[10px]">Unidad</Label>
              <Input value={newUnidad} onChange={(e) => setNewUnidad(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" size="sm" variant="ghost" onClick={() => setAgregando(false)}>
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={handleAdd}>Agregar</Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setAgregando(true)}>
          <Plus className="h-4 w-4" />
          Agregar item al remito
        </Button>
      )}
    </div>
  );
}
