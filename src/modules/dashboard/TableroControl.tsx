import { Link } from "react-router-dom";
import { Loader2, Gauge, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";
import { useTableroControl, type TableroControl as Tablero } from "./useTableroControl";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const nombreMes = (yyyymm: string) => MESES[parseInt(yyyymm.slice(5, 7), 10) - 1] ?? yyyymm;

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <h3 className="font-semibold text-sm">{titulo}</h3>
        {children}
      </CardContent>
    </Card>
  );
}

function Dato({ label, value, tono }: { label: string; value: string | number; tono?: "mal" | "bien" }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className={cn("text-lg font-bold leading-tight",
        tono === "mal" && "text-destructive", tono === "bien" && "text-success")}>
        {value}
      </div>
    </div>
  );
}

const Vacio = ({ texto }: { texto: string }) => <p className="text-xs text-muted-foreground">{texto}</p>;

export function TableroControl() {
  const { data, isLoading, error } = useTableroControl(true);

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Gauge className="h-5 w-5 text-primary" />
        Tablero de control
      </h2>

      {isLoading ? (
        <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
      ) : error || !data ? (
        <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">
          No se pudo cargar el tablero. ¿Se corrió <code>sql/069_tablero_control.sql</code>?
          {error && (
            <p className="mt-2 text-xs text-destructive break-words">
              Detalle: {(error as { message?: string }).message ?? String(error)}
            </p>
          )}
        </CardContent></Card>
      ) : (
        <TableroContenido d={data} />
      )}
    </div>
  );
}

function TableroContenido({ d }: { d: Tablero }) {
  const maxGasto = Math.max(1, ...d.gasto_mensual.map(m => m.compras + m.caja_chica));
  const maxMat = Math.max(1, ...d.materiales.map(m => m.total));
  const enRiesgo = d.obras.obras
    .filter(o => o.margen < 0 || (o.margen_pct !== null && o.margen_pct < 10))
    .slice(0, 5);
  const pctATiempo = d.plazos.cerradas > 0
    ? Math.round((d.plazos.cerradas_a_tiempo / d.plazos.cerradas) * 100)
    : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {/* 1. Plata */}
      <Seccion titulo="Plata de las obras en curso">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Dato label="Presupuesto" value={formatCurrency(d.obras.presupuesto)} />
          <Dato label="Costo" value={formatCurrency(d.obras.costo)} />
          <Dato label="Margen" value={formatCurrency(d.obras.margen)} tono={d.obras.margen < 0 ? "mal" : "bien"} />
        </div>
        {enRiesgo.length === 0 ? (
          <Vacio texto={d.obras.cantidad === 0 ? "No hay obras en curso." : "Ninguna obra con margen bajo."} />
        ) : (
          <div className="space-y-1.5">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-destructive" /> Margen menor al 10 %
            </div>
            {enRiesgo.map(o => (
              <Link
                key={o.id}
                to={`/obras/${o.id}`}
                className="flex items-center justify-between text-sm hover:bg-accent rounded px-2 py-1"
              >
                <span className="truncate">{o.codigo} · {o.nombre ?? "—"}</span>
                <span className={cn("shrink-0 font-medium", o.margen < 0 ? "text-destructive" : "text-warning")}>
                  {o.margen_pct !== null ? `${o.margen_pct} %` : "sin presupuesto"}
                </span>
              </Link>
            ))}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          Costo = materiales retirados + herramientas no devueltas + costos extras + horas técnicas.
        </p>
      </Seccion>

      {/* 2. Gasto mensual */}
      <Seccion titulo="Gasto de los últimos 6 meses">
        <div className="flex items-end gap-2 h-32">
          {d.gasto_mensual.map(m => {
            const total = m.compras + m.caja_chica;
            return (
              <div
                key={m.mes}
                className="flex-1 flex flex-col items-center justify-end h-full gap-1"
                title={`Compras ${formatCurrency(m.compras)} · Caja chica ${formatCurrency(m.caja_chica)}`}
              >
                <div className="w-full flex flex-col justify-end" style={{ height: `${(total / maxGasto) * 100}%` }}>
                  <div className="bg-primary/50 w-full" style={{ height: `${total ? (m.caja_chica / total) * 100 : 0}%` }} />
                  <div className="bg-primary w-full flex-1 min-h-[2px]" />
                </div>
                <span className="text-[10px] text-muted-foreground">{nombreMes(m.mes)}</span>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2 w-2 bg-primary inline-block" /> Compras (en pesos)</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 bg-primary/50 inline-block" /> Caja chica</span>
        </div>
      </Seccion>

      {/* 3. Materiales */}
      <Seccion titulo="Materiales que más costo generan">
        {d.materiales.length === 0 ? (
          <Vacio texto="Todavía no hay materiales retirados para obras." />
        ) : (
          <div className="space-y-2">
            {d.materiales.map(m => (
              <div key={m.codigo} className="space-y-0.5">
                <div className="flex justify-between text-xs gap-2">
                  <span className="truncate">{m.descripcion}</span>
                  <span className="shrink-0 text-muted-foreground">{formatCurrency(m.total)}</span>
                </div>
                <div className="h-1.5 bg-secondary rounded">
                  <div className="h-full bg-primary rounded" style={{ width: `${(m.total / maxMat) * 100}%` }} />
                </div>
                <div className="text-[10px] text-muted-foreground">{Number(m.cantidad)} {m.unidad} consumidos</div>
              </div>
            ))}
          </div>
        )}
      </Seccion>

      {/* 4. Clientes */}
      <Seccion titulo="Clientes">
        <div className="grid grid-cols-3 gap-3">
          <Dato label="Activos" value={d.clientes.total} />
          <Dato label="Con obra en curso" value={d.clientes.con_obra_en_curso} />
          <Dato label="Repitieron" value={d.clientes.recurrentes} />
        </div>
        {d.clientes.top.length === 0 ? (
          <Vacio texto="Sin obras cargadas." />
        ) : (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Los que más presupuesto concentran</div>
            {d.clientes.top.map(c => (
              <div key={c.nombre} className="flex justify-between text-sm gap-2">
                <span className="truncate">
                  {c.nombre}{" "}
                  <span className="text-muted-foreground text-xs">({c.obras} obra{c.obras === 1 ? "" : "s"})</span>
                </span>
                <span className="shrink-0">{formatCurrency(c.presupuesto)}</span>
              </div>
            ))}
          </div>
        )}
      </Seccion>

      {/* 5. Personal */}
      <Seccion titulo="Personal técnico (mes actual)">
        {d.personal.length === 0 ? (
          <Vacio texto="No hay técnicos activos." />
        ) : (
          <div className="space-y-1">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 text-[10px] text-muted-foreground uppercase">
              <span>Técnico</span>
              <span className="text-right">Horas</span>
              <span className="text-right">Reportes</span>
              <span className="text-right">Herram.</span>
            </div>
            {d.personal.map(p => (
              <div key={p.nombre} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 text-sm">
                <span className="truncate">{p.nombre}</span>
                <span className="text-right">{p.horas_mes}</span>
                <span className="text-right">{p.reportes_mes}</span>
                <span className={cn("text-right", p.herramientas_en_poder > 0 && "text-warning")}>
                  {p.herramientas_en_poder}
                </span>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground pt-1">Herram. = unidades que tiene a su cargo hoy.</p>
          </div>
        )}
      </Seccion>

      {/* 6. Plazos */}
      <Seccion titulo="Plazos">
        <div className="grid grid-cols-2 gap-3">
          <Dato label="Obras atrasadas" value={d.plazos.atrasadas} tono={d.plazos.atrasadas > 0 ? "mal" : undefined} />
          <Dato label="Cerradas a tiempo" value={pctATiempo === null ? "—" : `${pctATiempo} %`} />
        </div>
        {d.plazos.lista_atrasadas.length > 0 && (
          <div className="space-y-1">
            {d.plazos.lista_atrasadas.map(o => (
              <Link
                key={o.id}
                to={`/obras/${o.id}`}
                className="flex justify-between text-sm hover:bg-accent rounded px-2 py-1"
              >
                <span className="truncate">{o.codigo} · {o.nombre ?? "—"}</span>
                <span className="shrink-0 text-destructive">{o.dias} día{o.dias === 1 ? "" : "s"}</span>
              </Link>
            ))}
          </div>
        )}
      </Seccion>
    </div>
  );
}
