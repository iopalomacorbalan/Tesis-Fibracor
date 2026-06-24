import { useState, useMemo } from "react";
import { Wallet, Loader2, Plus, Trash2, FileSpreadsheet, Paperclip, Building2, FileText } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { Navigate } from "react-router-dom";
import { formatDate, formatCurrency, cn } from "@/lib/utils";
import { useObras } from "@/modules/obras/useObras";
import {
  useCajaChica, useAgregarGasto, useEliminarGasto,
  useSaldoCaja, useMovimientosCaja, useAgregarMovimientoCaja,
  CATEGORIAS_CAJA, MEDIOS_PAGO, type CajaChicaGasto,
} from "./useCajaChica";

export default function CajaChicaPage() {
  const { profile } = useAuth();
  const hoy = new Date();
  const y = hoy.getFullYear(); const m = hoy.getMonth();
  const [desde, setDesde] = useState(`${y}-${String(m + 1).padStart(2, "0")}-01`);
  const ultimoDiaN = new Date(y, m + 1, 0).getDate();
  const [hasta, setHasta] = useState(`${y}-${String(m + 1).padStart(2, "0")}-${String(ultimoDiaN).padStart(2, "0")}`);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: gastos = [], isLoading } = useCajaChica(desde, hasta);
  const { data: saldo = 0 } = useSaldoCaja();
  const { data: movimientos = [] } = useMovimientosCaja();
  const eliminar = useEliminarGasto();
  const [movDialogOpen, setMovDialogOpen] = useState(false);

  const puedeAcceder = profile && ["Direccion", "Operaciones", "Contabilidad"].includes(profile.area);
  if (profile && !puedeAcceder) return <Navigate to="/" replace />;

  const totales = useMemo(() => {
    const obra = gastos.filter(g => g.tipo === "obra").reduce((s, g) => s + g.monto, 0);
    const admin = gastos.filter(g => g.tipo === "administrativo").reduce((s, g) => s + g.monto, 0);
    return { obra, admin, total: obra + admin };
  }, [gastos]);

  const handleEliminar = async (g: CajaChicaGasto) => {
    if (!confirm(`¿Eliminar el gasto "${g.concepto}"?`)) return;
    try {
      await eliminar.mutateAsync(g);
      toast.success("Gasto eliminado");
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  const exportarExcel = () => {
    if (gastos.length === 0 && movimientos.length === 0) { toast.error("No hay datos para exportar"); return; }
    const wb = XLSX.utils.book_new();

    // Hoja 1: Gastos
    const rows = gastos.map(g => ({
      "Fecha": formatDate(g.fecha),
      "Tipo": g.tipo === "obra" ? "Obra" : "Administrativo",
      "Obra": g.obra?.obra_id ?? "",
      "Cliente": g.obra?.cliente?.nombre ?? "",
      "Categoría": g.categoria,
      "Concepto": g.concepto,
      "Monto": g.monto,
      "Descuenta caja": g.descuenta_caja ? "Sí" : "No",
      "Medio de pago": g.medio_pago ?? "",
      "Comprobante": g.comprobante_url ? "Sí" : "No",
      "Cargado por": g.creador?.nombre ?? "",
      "Observaciones": g.observaciones ?? "",
    }));
    if (rows.length > 0) {
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [{ wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 20 }, { wch: 16 }, { wch: 30 }, { wch: 12 }, { wch: 13 }, { wch: 14 }, { wch: 11 }, { wch: 18 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, ws, "Gastos");
    }

    // Hoja 2: Ingresos y ajustes de saldo
    const movRows = movimientos.map(m => ({
      "Fecha": formatDate(m.fecha),
      "Tipo": m.tipo === "ingreso" ? "Ingreso (suma)" : "Ajuste de saldo",
      "Monto": m.monto,
      "Concepto": m.concepto ?? "",
      "Cargado por": m.creador?.nombre ?? "",
    }));
    if (movRows.length > 0) {
      const wsMov = XLSX.utils.json_to_sheet(movRows);
      wsMov["!cols"] = [{ wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 30 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, wsMov, "Ingresos y ajustes");
    }

    XLSX.writeFile(wb, `CajaChica_${desde}_${hasta}.xlsx`);
    toast.success("Excel descargado");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
            <Wallet className="h-8 w-8 text-primary" />
            Caja Chica
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Gastos administrativos y de obra. Los gastos de obra se reflejan en su centro de costos.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo gasto
        </Button>
      </div>

      {/* Saldo disponible destacado */}
      <Card className={cn("border-2", saldo < 0 ? "border-destructive/40 bg-destructive/5" : "border-primary/30 bg-primary/5")}>
        <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Saldo disponible en caja chica</div>
            <div className={cn("text-3xl font-bold mt-1", saldo < 0 ? "text-destructive" : "text-primary")}>
              {formatCurrency(saldo)}
            </div>
            {saldo < 0 && <div className="text-xs text-destructive mt-0.5">⚠️ La caja está en negativo</div>}
          </div>
          <Button variant="outline" onClick={() => setMovDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Ingreso / Ajuste
          </Button>
        </CardContent>
      </Card>

      {/* Filtro de período + exportar */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Desde</Label>
            <Input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="w-full sm:w-44" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Hasta</Label>
            <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="w-full sm:w-44" />
          </div>
          <Button variant="outline" onClick={exportarExcel} disabled={gastos.length === 0 && movimientos.length === 0} className="ml-auto">
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
          </Button>
        </CardContent>
      </Card>

      {/* Totales */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card><CardContent className="p-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Building2 className="h-3 w-3" /> Gastos de obra</div>
          <div className="text-lg font-bold mt-0.5">{formatCurrency(totales.obra)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><FileText className="h-3 w-3" /> Administrativos</div>
          <div className="text-lg font-bold mt-0.5">{formatCurrency(totales.admin)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Total período</div>
          <div className="text-lg font-bold mt-0.5 text-primary">{formatCurrency(totales.total)}</div>
        </CardContent></Card>
      </div>

      {/* Lista */}
      {isLoading ? (
        <Card><CardContent className="py-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></CardContent></Card>
      ) : gastos.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          No hay gastos en este período. Cargá uno con "Nuevo gasto".
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {gastos.map(g => (
            <Card key={g.id}>
              <CardContent className="p-3 flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{g.concepto}</span>
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border",
                      g.tipo === "obra" ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground")}>
                      {g.tipo === "obra" ? "Obra" : "Administrativo"}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{g.categoria}</span>
                    {g.comprobante_url && (
                      <a href={g.comprobante_url} target="_blank" rel="noopener noreferrer"
                        className="text-[10px] text-primary flex items-center gap-0.5 hover:underline">
                        <Paperclip className="h-3 w-3" /> Comprobante
                      </a>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {formatDate(g.fecha)}
                    {g.obra && <> · Obra <b>{g.obra.obra_id}</b>{g.obra.cliente?.nombre && ` (${g.obra.cliente.nombre})`}</>}
                    {g.medio_pago && <> · {g.medio_pago}</>}
                    {g.creador?.nombre && <> · cargó <b>{g.creador.nombre}</b></>}
                    {!g.descuenta_caja && <> · <span className="text-muted-foreground italic">no descuenta caja</span></>}
                  </div>
                  {g.observaciones && <div className="text-[11px] text-muted-foreground italic mt-1">"{g.observaciones}"</div>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold">{formatCurrency(g.monto)}</span>
                  <Button variant="ghost" size="sm" onClick={() => handleEliminar(g)} disabled={eliminar.isPending}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <NuevoGastoDialog open={dialogOpen} onOpenChange={setDialogOpen} saldo={saldo} />
      <MovimientoCajaDialog open={movDialogOpen} onOpenChange={setMovDialogOpen} saldoActual={saldo} />
    </div>
  );
}

function NuevoGastoDialog({ open, onOpenChange, saldo }: { open: boolean; onOpenChange: (o: boolean) => void; saldo: number }) {
  const { data: obras = [] } = useObras();
  const agregar = useAgregarGasto();

  const hoy = new Date().toISOString().slice(0, 10);
  const [tipo, setTipo] = useState<"obra" | "administrativo">("administrativo");
  const [obraId, setObraId] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<string>(CATEGORIAS_CAJA[0]);
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState<number>(0);
  const [fecha, setFecha] = useState(hoy);
  const [medioPago, setMedioPago] = useState<string>("Efectivo");
  const [descuentaCaja, setDescuentaCaja] = useState(true);
  const [observaciones, setObservaciones] = useState("");
  const [comprobante, setComprobante] = useState<File | null>(null);

  const reset = () => {
    setTipo("administrativo"); setObraId(null); setCategoria(CATEGORIAS_CAJA[0]);
    setConcepto(""); setMonto(0); setFecha(hoy); setMedioPago("Efectivo");
    setObservaciones(""); setComprobante(null); setDescuentaCaja(true);
  };

  const handleGuardar = async () => {
    if (!concepto.trim()) { toast.error("Ingresá un concepto"); return; }
    if (monto <= 0) { toast.error("El monto debe ser mayor a 0"); return; }
    if (tipo === "obra" && !obraId) { toast.error("Seleccioná la obra"); return; }
    try {
      await agregar.mutateAsync({
        tipo, obra_id: obraId, categoria, concepto: concepto.trim(),
        monto, fecha, medio_pago: medioPago,
        observaciones: observaciones.trim() || null,
        descuenta_caja: descuentaCaja,
        comprobante,
      });
      toast.success("Gasto cargado");
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  const obrasActivas = obras.filter((o: any) => o.estado !== "Cerrada" && o.estado !== "Cancelada");

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo gasto de caja chica</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Tipo */}
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de gasto</Label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setTipo("administrativo")}
                className={cn("flex-1 text-sm px-3 py-2 rounded-lg border transition-colors",
                  tipo === "administrativo" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input hover:border-primary/30")}>
                Administrativo
              </button>
              <button type="button" onClick={() => setTipo("obra")}
                className={cn("flex-1 text-sm px-3 py-2 rounded-lg border transition-colors",
                  tipo === "obra" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input hover:border-primary/30")}>
                Gasto de obra
              </button>
            </div>
          </div>

          {/* Obra (solo si tipo=obra) */}
          {tipo === "obra" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Obra *</Label>
              <Select value={obraId ?? ""} onValueChange={(v) => setObraId(v || null)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar obra..." /></SelectTrigger>
                <SelectContent>
                  {obrasActivas.map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.obra_id} — {o.cliente?.nombre ?? o.nombre_obra ?? "Sin nombre"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Categoría</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_CAJA.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Medio de pago</Label>
              <Select value={medioPago} onValueChange={setMedioPago}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MEDIOS_PAGO.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Concepto *</Label>
            <Input value={concepto} onChange={e => setConcepto(e.target.value)} placeholder="Ej: Nafta camioneta, almuerzo equipo..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Monto *</Label>
              <Input type="number" min="0" step="0.01" value={monto || ""} onChange={e => setMonto(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fecha</Label>
              <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Comprobante (opcional)</Label>
            <Input type="file" accept="image/*,.pdf" onChange={e => setComprobante(e.target.files?.[0] ?? null)} />
            {comprobante && <p className="text-[11px] text-muted-foreground">📎 {comprobante.name}</p>}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Observaciones (opcional)</Label>
            <Textarea rows={2} value={observaciones} onChange={e => setObservaciones(e.target.value)} />
          </div>

          <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-input p-2.5">
            <input type="checkbox" checked={descuentaCaja} onChange={e => setDescuentaCaja(e.target.checked)} className="h-4 w-4" />
            <span className="text-sm">Descontar del saldo de caja chica</span>
          </label>

          {descuentaCaja && monto > saldo && (
            <div className="text-xs text-warning bg-warning/10 border border-warning/30 rounded-lg p-2">
              ⚠️ El monto ({formatCurrency(monto)}) supera el saldo disponible ({formatCurrency(saldo)}). Se va a cargar igual y la caja quedará en negativo.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancelar</Button>
          <Button onClick={handleGuardar} disabled={agregar.isPending}>
            {agregar.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Guardar gasto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MovimientoCajaDialog({ open, onOpenChange, saldoActual }: { open: boolean; onOpenChange: (o: boolean) => void; saldoActual: number }) {
  const agregar = useAgregarMovimientoCaja();
  const { data: movimientos = [] } = useMovimientosCaja();
  const hoy = new Date().toISOString().slice(0, 10);

  const [tipo, setTipo] = useState<"ingreso" | "ajuste">("ingreso");
  const [monto, setMonto] = useState<number>(0);
  const [concepto, setConcepto] = useState("");
  const [fecha, setFecha] = useState(hoy);

  const handleGuardar = async () => {
    if (monto < 0) { toast.error("El monto no puede ser negativo"); return; }
    if (tipo === "ingreso" && monto <= 0) { toast.error("Ingresá un monto mayor a 0"); return; }
    try {
      await agregar.mutateAsync({ tipo, monto, concepto: concepto.trim() || null, fecha });
      toast.success(tipo === "ingreso" ? "Ingreso registrado" : "Saldo ajustado");
      setMonto(0); setConcepto(""); setTipo("ingreso");
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ingreso / Ajuste de caja</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex gap-2">
            <button type="button" onClick={() => setTipo("ingreso")}
              className={cn("flex-1 text-sm px-3 py-2 rounded-lg border transition-colors",
                tipo === "ingreso" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input")}>
              Ingreso (suma)
            </button>
            <button type="button" onClick={() => setTipo("ajuste")}
              className={cn("flex-1 text-sm px-3 py-2 rounded-lg border transition-colors",
                tipo === "ajuste" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input")}>
              Ajustar saldo
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            {tipo === "ingreso"
              ? "Suma este monto al saldo actual (ej: reposición de caja)."
              : `Fija el saldo a este valor exacto (corrige el actual de ${formatCurrency(saldoActual)}).`}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{tipo === "ingreso" ? "Monto a sumar" : "Nuevo saldo"}</Label>
              <Input type="number" min="0" step="0.01" value={monto || ""} onChange={e => setMonto(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fecha</Label>
              <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Concepto (opcional)</Label>
            <Input value={concepto} onChange={e => setConcepto(e.target.value)} placeholder={tipo === "ingreso" ? "Ej: reposición mensual" : "Ej: corrección de arqueo"} />
          </div>

          {movimientos.length > 0 && (
            <div className="pt-2 border-t">
              <Label className="text-xs text-muted-foreground">Últimos movimientos</Label>
              <div className="mt-1 space-y-1 max-h-32 overflow-y-auto">
                {movimientos.slice(0, 8).map(m => (
                  <div key={m.id} className="flex justify-between text-xs py-1 border-b last:border-0">
                    <span className="text-muted-foreground">
                      {formatDate(m.fecha)} · {m.tipo === "ingreso" ? "Ingreso" : "Ajuste"}
                      {m.concepto && ` · ${m.concepto}`}
                      {m.creador?.nombre && ` · ${m.creador.nombre}`}
                    </span>
                    <span className={m.tipo === "ingreso" ? "text-success" : ""}>
                      {m.tipo === "ingreso" ? "+" : "="}{formatCurrency(m.monto)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleGuardar} disabled={agregar.isPending}>
            {agregar.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
