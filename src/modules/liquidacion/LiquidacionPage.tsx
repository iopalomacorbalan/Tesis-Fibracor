import { useState, useMemo } from "react";
import { Clock, Loader2, FileDown, FileSpreadsheet, Settings2, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { Navigate } from "react-router-dom";
import { formatDate, formatCurrency, cn } from "@/lib/utils";
import { PDF_COLORS, PAGE, drawHeader, paginarTodo } from "@/lib/pdf/helpers";
import {
  useLiquidacionHoras, useValoresGlobales, useGuardarValoresGlobales,
  useTecnicosValores, useGuardarValorTecnico, type TecnicoLiquidacion,
} from "./useLiquidacion";

function primerDiaMes(yyyymm: string) { return `${yyyymm}-01`; }
function ultimoDiaMes(yyyymm: string) {
  const [y, m] = yyyymm.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${yyyymm}-${String(last).padStart(2, "0")}`;
}

export default function LiquidacionPage() {
  const { profile } = useAuth();
  const hoy = new Date();
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
  const [mes, setMes] = useState(mesActual);
  const [configOpen, setConfigOpen] = useState(false);

  const desde = primerDiaMes(mes);
  const hasta = ultimoDiaMes(mes);

  const { data: tecnicos = [], isLoading } = useLiquidacionHoras(desde, hasta);
  const { data: valores } = useValoresGlobales();

  const puedeAcceder = profile && ["Direccion", "Operaciones", "Contabilidad"].includes(profile.area);
  if (profile && !puedeAcceder) return <Navigate to="/" replace />;

  const totales = useMemo(() => ({
    horas: tecnicos.reduce((s, t) => s + t.total_horas, 0),
    normales: tecnicos.reduce((s, t) => s + t.total_normales, 0),
    extras: tecnicos.reduce((s, t) => s + t.total_extras, 0),
    monto: tecnicos.reduce((s, t) => s + t.monto_total, 0),
  }), [tecnicos]);

  // ===== Export Excel =====
  const exportarExcel = () => {
    if (tecnicos.length === 0) { toast.error("No hay datos para exportar"); return; }
    const wb = XLSX.utils.book_new();

    // Hoja resumen
    const resumen = tecnicos.map(t => ({
      "Técnico": t.tecnico_nombre,
      "Días trabajados": t.dias.length,
      "Horas totales": Number(t.total_horas.toFixed(2)),
      "Horas normales": Number(t.total_normales.toFixed(2)),
      "Horas extras": Number(t.total_extras.toFixed(2)),
      "Valor hora": t.valor_hora,
      "Valor hora extra": t.valor_hora_extra,
      "Monto normales": Number(t.monto_normales.toFixed(2)),
      "Monto extras": Number(t.monto_extras.toFixed(2)),
      "TOTAL A LIQUIDAR": Number(t.monto_total.toFixed(2)),
    }));
    const wsResumen = XLSX.utils.json_to_sheet(resumen);
    wsResumen["!cols"] = Object.keys(resumen[0] ?? {}).map(() => ({ wch: 16 }));
    XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");

    // Hoja detalle por técnico
    for (const t of tecnicos) {
      const detalle = t.dias.map(d => ({
        "Fecha": formatDate(d.fecha),
        "Horas del día": Number(d.horas_dia.toFixed(2)),
        "Normales": Number(d.horas_normales.toFixed(2)),
        "Extras": Number(d.horas_extras.toFixed(2)),
        "Obras": d.obras ?? "",
      }));
      detalle.push({
        "Fecha": "TOTAL",
        "Horas del día": Number(t.total_horas.toFixed(2)),
        "Normales": Number(t.total_normales.toFixed(2)),
        "Extras": Number(t.total_extras.toFixed(2)),
        "Obras": "",
      } as any);
      const ws = XLSX.utils.json_to_sheet(detalle);
      ws["!cols"] = [{ wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 30 }];
      // Nombre de hoja max 31 chars, sin caracteres raros
      const nombre = t.tecnico_nombre.replace(/[\\\/\?\*\[\]:]/g, "").slice(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, nombre || t.tecnico_id.slice(0, 8));
    }

    XLSX.writeFile(wb, `Liquidacion_${mes}.xlsx`);
    toast.success("Excel descargado");
  };

  // ===== Export PDF =====
  const exportarPdf = async () => {
    if (tecnicos.length === 0) { toast.error("No hay datos para exportar"); return; }
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    let y = await drawHeader(doc, "Liquidación de horas", mes);

    // Resumen general
    autoTable(doc, {
      startY: y,
      head: [["Técnico", "Días", "Hs tot.", "Hs norm.", "Hs extra", "$/h", "$/h extra", "Monto norm.", "Monto extra", "TOTAL"]],
      body: tecnicos.map(t => [
        t.tecnico_nombre,
        t.dias.length,
        t.total_horas.toFixed(2),
        t.total_normales.toFixed(2),
        t.total_extras.toFixed(2),
        formatCurrency(t.valor_hora),
        formatCurrency(t.valor_hora_extra),
        formatCurrency(t.monto_normales),
        formatCurrency(t.monto_extras),
        formatCurrency(t.monto_total),
      ]),
      foot: [[
        "TOTALES", "", totales.horas.toFixed(2), totales.normales.toFixed(2), totales.extras.toFixed(2),
        "", "", "", "", formatCurrency(totales.monto),
      ]],
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: PDF_COLORS.primary, fontSize: 6.5 },
      footStyles: { fillColor: [240, 240, 240], textColor: PDF_COLORS.text, fontStyle: "bold" },
      margin: { left: PAGE.margin, right: PAGE.margin },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // Detalle por técnico
    for (const t of tecnicos) {
      if (y > PAGE.height - 60) { doc.addPage(); y = 20; }
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...PDF_COLORS.text);
      doc.text(t.tecnico_nombre, PAGE.margin, y);
      y += 3;
      autoTable(doc, {
        startY: y,
        head: [["Fecha", "Horas", "Normales", "Extras", "Obras"]],
        body: t.dias.map(d => [
          formatDate(d.fecha),
          d.horas_dia.toFixed(2),
          d.horas_normales.toFixed(2),
          d.horas_extras.toFixed(2) + (d.horas_extras > 0 ? " ⚠" : ""),
          d.obras ?? "",
        ]),
        foot: [["TOTAL", t.total_horas.toFixed(2), t.total_normales.toFixed(2), t.total_extras.toFixed(2), ""]],
        styles: { fontSize: 7.5, cellPadding: 1.5 },
        headStyles: { fillColor: [100, 116, 139], fontSize: 7 },
        footStyles: { fillColor: [245, 245, 245], textColor: PDF_COLORS.text, fontStyle: "bold" },
        margin: { left: PAGE.margin, right: PAGE.margin },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    paginarTodo(doc);
    doc.save(`Liquidacion_${mes}.pdf`);
    toast.success("PDF descargado");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
            <Clock className="h-8 w-8 text-primary" />
            Liquidación de horas
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Horas por técnico con extras (más de 8h/día). Exportable para liquidación de sueldos.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)}>
          <Settings2 className="h-4 w-4 mr-1" /> Valores hora
        </Button>
      </div>

      {/* Selector de período + exportar */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Período (mes)</Label>
            <Input
              type="month"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="w-44"
            />
          </div>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={exportarPdf} disabled={tecnicos.length === 0}>
              <FileDown className="h-4 w-4 mr-1" /> PDF
            </Button>
            <Button variant="outline" onClick={exportarExcel} disabled={tecnicos.length === 0}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Totales del período */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat label="Horas totales" value={totales.horas.toFixed(1)} />
        <MiniStat label="Horas normales" value={totales.normales.toFixed(1)} />
        <MiniStat label="Horas extras" value={totales.extras.toFixed(1)} warning={totales.extras > 0} />
        <MiniStat label="Total a liquidar" value={formatCurrency(totales.monto)} primary />
      </div>

      {/* Lista por técnico */}
      {isLoading ? (
        <Card><CardContent className="py-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></CardContent></Card>
      ) : tecnicos.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          No hay horas registradas en este período. Las horas salen de los reportes de obra (entrada/salida).
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {tecnicos.map(t => <TecnicoCard key={t.tecnico_id} t={t} />)}
        </div>
      )}

      <ConfigValoresDialog open={configOpen} onOpenChange={setConfigOpen} />
    </div>
  );
}

function MiniStat({ label, value, primary, warning }: { label: string; value: string; primary?: boolean; warning?: boolean }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
        <div className={cn("text-lg font-bold mt-0.5",
          primary && "text-primary", warning && "text-warning")}>{value}</div>
      </CardContent>
    </Card>
  );
}

function TecnicoCard({ t }: { t: TecnicoLiquidacion }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <button type="button" className="w-full text-left" onClick={() => setAbierto(v => !v)}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              {abierto ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              <span className="font-semibold">{t.tecnico_nombre}</span>
              <span className="text-xs text-muted-foreground">({t.dias.length} días)</span>
            </div>
            <div className="flex gap-4 text-xs flex-wrap">
              <span>Total: <b>{t.total_horas.toFixed(1)}h</b></span>
              <span>Normales: <b>{t.total_normales.toFixed(1)}h</b></span>
              <span className={t.total_extras > 0 ? "text-warning" : ""}>
                Extras: <b>{t.total_extras.toFixed(1)}h</b>
              </span>
              <span className="text-primary font-semibold">{formatCurrency(t.monto_total)}</span>
            </div>
          </div>
        </button>

        {abierto && (
          <div className="mt-3 pt-3 border-t space-y-2">
            <div className="text-xs text-muted-foreground flex gap-4 flex-wrap">
              <span>Valor hora: <b>{formatCurrency(t.valor_hora)}</b></span>
              <span>Valor hora extra: <b>{formatCurrency(t.valor_hora_extra)}</b></span>
              <span>Monto normales: <b>{formatCurrency(t.monto_normales)}</b></span>
              <span>Monto extras: <b>{formatCurrency(t.monto_extras)}</b></span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-1.5 pr-2">Fecha</th>
                    <th className="text-right py-1.5 px-2">Horas</th>
                    <th className="text-right py-1.5 px-2">Normales</th>
                    <th className="text-right py-1.5 px-2">Extras</th>
                    <th className="text-left py-1.5 pl-2">Obras</th>
                  </tr>
                </thead>
                <tbody>
                  {t.dias.map(d => (
                    <tr key={d.fecha} className="border-b last:border-0">
                      <td className="py-1.5 pr-2">{formatDate(d.fecha)}</td>
                      <td className="text-right py-1.5 px-2 font-medium">{d.horas_dia.toFixed(2)}</td>
                      <td className="text-right py-1.5 px-2">{d.horas_normales.toFixed(2)}</td>
                      <td className={cn("text-right py-1.5 px-2", d.horas_extras > 0 && "text-warning font-semibold")}>
                        {d.horas_extras > 0 ? d.horas_extras.toFixed(2) : "—"}
                      </td>
                      <td className="py-1.5 pl-2 text-muted-foreground">{d.obras ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ConfigValoresDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: valores } = useValoresGlobales();
  const { data: tecnicos = [] } = useTecnicosValores();
  const guardarGlobal = useGuardarValoresGlobales();
  const guardarTecnico = useGuardarValorTecnico();

  const [vHora, setVHora] = useState<string>("");
  const [vExtra, setVExtra] = useState<string>("");
  const [overrides, setOverrides] = useState<Record<string, { h: string; e: string }>>({});

  const handleAbrir = (o: boolean) => {
    if (o && valores) {
      setVHora(String(valores.valor_hora || ""));
      setVExtra(String(valores.valor_hora_extra || ""));
      const init: Record<string, { h: string; e: string }> = {};
      for (const t of tecnicos) {
        init[t.id] = {
          h: t.valor_hora != null ? String(t.valor_hora) : "",
          e: t.valor_hora_extra != null ? String(t.valor_hora_extra) : "",
        };
      }
      setOverrides(init);
    }
    onOpenChange(o);
  };

  const handleGuardar = async () => {
    try {
      await guardarGlobal.mutateAsync({
        valor_hora: parseFloat(vHora) || 0,
        valor_hora_extra: parseFloat(vExtra) || 0,
      });
      for (const t of tecnicos) {
        const ov = overrides[t.id];
        if (!ov) continue;
        const h = ov.h.trim() === "" ? null : parseFloat(ov.h) || null;
        const e = ov.e.trim() === "" ? null : parseFloat(ov.e) || null;
        if (h !== t.valor_hora || e !== t.valor_hora_extra) {
          await guardarTecnico.mutateAsync({ id: t.id, valor_hora: h, valor_hora_extra: e });
        }
      }
      toast.success("Valores guardados");
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleAbrir}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Valores de hora para liquidación</DialogTitle>
          <DialogDescription>
            El valor global aplica a todos. Podés poner un valor distinto por técnico (dejá vacío para usar el global).
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Valor hora global (ARS)</Label>
            <Input type="number" min="0" step="0.01" value={vHora} onChange={e => setVHora(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Valor hora extra global (ARS)</Label>
            <Input type="number" min="0" step="0.01" value={vExtra} onChange={e => setVExtra(e.target.value)} />
          </div>
        </div>

        {tecnicos.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <Label className="text-xs text-muted-foreground">Override por técnico (opcional)</Label>
            {tecnicos.map(t => (
              <div key={t.id} className="grid grid-cols-[1fr_90px_90px] gap-2 items-center">
                <span className="text-sm truncate">{t.nombre}</span>
                <Input
                  type="number" min="0" step="0.01" placeholder="hora"
                  className="h-8 text-xs"
                  value={overrides[t.id]?.h ?? ""}
                  onChange={e => setOverrides(prev => ({ ...prev, [t.id]: { h: e.target.value, e: prev[t.id]?.e ?? "" } }))}
                />
                <Input
                  type="number" min="0" step="0.01" placeholder="extra"
                  className="h-8 text-xs"
                  value={overrides[t.id]?.e ?? ""}
                  onChange={e => setOverrides(prev => ({ ...prev, [t.id]: { h: prev[t.id]?.h ?? "", e: e.target.value } }))}
                />
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleGuardar} disabled={guardarGlobal.isPending || guardarTecnico.isPending}>
            {(guardarGlobal.isPending || guardarTecnico.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
