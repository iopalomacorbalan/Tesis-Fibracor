import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTecnicos } from "@/modules/obras/useUsuarios";
import type { EstadoObra, ObraConRelaciones } from "@/types/database";

const COLOR_POR_ESTADO: Record<EstadoObra, { bg: string; text: string }> = {
  "Pendiente OIO": { bg: "#FBBF24", text: "#78350F" },
  "En ejecucion":  { bg: "#34D399", text: "#064E3B" },
  "Para cierre":   { bg: "#60A5FA", text: "#1E3A8A" },
  "Cerrada":       { bg: "#94A3B8", text: "#1E293B" },
  "Cancelada":     { bg: "#F87171", text: "#7F1D1D" },
};

const MS_DIA = 86400000;
const ALTO_CARRIL = 28;      // alto de cada obra
const ANCHO_NOMBRE = 190;    // columna con el nombre del técnico
const ANCHO_DIA = 46;        // ancho mínimo de cada día
const DIAS_SEMANA = ["D", "L", "M", "M", "J", "V", "S"];

function aFecha(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}
const diasEntre = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / MS_DIA);
const sumarDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
function lunesDe(d: Date): Date {
  const dia = (d.getDay() + 6) % 7; // lunes = 0
  return sumarDias(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -dia);
}
const mismoDia = (a: Date, b: Date) => diasEntre(a, b) === 0;

interface Tramo {
  obra: ObraConRelaciones;
  desde: number;   // índice de día (0 = primer día visible)
  hasta: number;   // índice de día, inclusive
  carril: number;
  recortadaIzq: boolean;
  recortadaDer: boolean;
}

function fechasDe(o: ObraConRelaciones): { ini: Date; fin: Date } | null {
  const ini = o.fecha_inicio_real ?? o.fecha_inicio_est;
  if (!ini) return null;
  const fin = o.fecha_fin_real ?? o.fecha_fin_est ?? ini;
  return { ini: aFecha(ini), fin: aFecha(fin) };
}

/** Reparte las obras de una fila en carriles para que las que coinciden en fechas no se tapen */
function armarTramos(obras: ObraConRelaciones[], inicioVista: Date, totalDias: number): { tramos: Tramo[]; carriles: number } {
  const visibles = obras
    .map(o => ({ o, f: fechasDe(o) }))
    .filter((x): x is { o: ObraConRelaciones; f: { ini: Date; fin: Date } } => {
      if (!x.f) return false;
      return diasEntre(inicioVista, x.f.fin) >= 0 && diasEntre(inicioVista, x.f.ini) <= totalDias - 1;
    })
    .sort((a, b) => a.f.ini.getTime() - b.f.ini.getTime());

  const finPorCarril: number[] = [];
  const tramos: Tramo[] = visibles.map(({ o, f }) => {
    const ini = diasEntre(inicioVista, f.ini);
    const fin = diasEntre(inicioVista, f.fin);
    let carril = finPorCarril.findIndex(ultimo => ultimo < ini);
    if (carril === -1) { carril = finPorCarril.length; finPorCarril.push(fin); }
    else finPorCarril[carril] = fin;
    return {
      obra: o,
      desde: Math.max(0, ini),
      hasta: Math.min(totalDias - 1, fin),
      carril,
      recortadaIzq: ini < 0,
      recortadaDer: fin > totalDias - 1,
    };
  });
  return { tramos, carriles: Math.max(1, finPorCarril.length) };
}

export function VistaPorTecnico({ obras }: { obras: ObraConRelaciones[] }) {
  const navigate = useNavigate();
  const { data: tecnicos = [] } = useTecnicos();
  const hoy = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }, []);
  const [inicio, setInicio] = useState(() => lunesDe(hoy));
  const [totalDias, setTotalDias] = useState(28);

  const dias = useMemo(() => Array.from({ length: totalDias }, (_, i) => sumarDias(inicio, i)), [inicio, totalDias]);

  const obrasActivas = useMemo(() => obras.filter(o => o.estado !== "Cancelada"), [obras]);

  // Una fila por técnico (aparezca o no en alguna obra) + una fila para las obras sin técnicos
  const filas = useMemo(() => {
    const porTecnico = [...tecnicos]
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map(t => {
        const propias = obrasActivas.filter(o => o.tecnicos?.some(x => x.id === t.id));
        return { id: t.id, nombre: t.nombre, ...armarTramos(propias, inicio, totalDias) };
      });
    const sinTecnico = obrasActivas.filter(o => !o.tecnicos || o.tecnicos.length === 0);
    return { porTecnico, sinTecnico: { ...armarTramos(sinTecnico, inicio, totalDias), cantidad: sinTecnico.length } };
  }, [tecnicos, obrasActivas, inicio, totalDias]);

  const fin = dias[dias.length - 1];
  const rango = `${inicio.toLocaleDateString("es-AR", { day: "numeric", month: "short" })} – ${fin.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}`;

  const columnas = `${ANCHO_NOMBRE}px repeat(${totalDias}, minmax(${ANCHO_DIA}px, 1fr))`;

  /** Fondo de columnas: fines de semana y día de hoy */
  const Fondo = () => (
    <>
      {dias.map((d, i) => (
        <div
          key={i}
          style={{ gridColumn: i + 2, gridRow: "1 / -1" }}
          className={cn(
            "border-l border-border/60",
            (d.getDay() === 0 || d.getDay() === 6) && "bg-muted/30",
            mismoDia(d, hoy) && "bg-primary/10",
          )}
        />
      ))}
    </>
  );

  const Barras = ({ tramos }: { tramos: Tramo[] }) => (
    <>
      {tramos.map(t => {
        const color = COLOR_POR_ESTADO[t.obra.estado] ?? COLOR_POR_ESTADO["En ejecucion"];
        const f = fechasDe(t.obra)!;
        const detalle = `${t.obra.obra_id} — ${t.obra.nombre_obra ?? "Sin nombre"}\n${t.obra.cliente?.nombre ?? ""}\n${f.ini.toLocaleDateString("es-AR")} al ${f.fin.toLocaleDateString("es-AR")} · ${t.obra.estado}`;
        return (
          <button
            key={t.obra.id}
            type="button"
            title={detalle}
            onClick={() => navigate(`/obras/${t.obra.id}`)}
            style={{
              gridColumn: `${t.desde + 2} / ${t.hasta + 3}`,
              gridRow: t.carril + 1,
              background: color.bg,
              color: color.text,
              height: ALTO_CARRIL - 4,
              marginTop: 2,
            }}
            className={cn(
              "z-10 px-2 text-xs font-medium truncate text-left hover:brightness-110 transition",
              t.recortadaIzq ? "rounded-l-none" : "rounded-l-md",
              t.recortadaDer ? "rounded-r-none" : "rounded-r-md",
            )}
          >
            {t.recortadaIzq && "◂ "}{t.obra.obra_id} {t.obra.nombre_obra ?? ""}{t.recortadaDer && " ▸"}
          </button>
        );
      })}
    </>
  );

  const Fila = ({ nombre, tramos, carriles, etiqueta }: { nombre: string; tramos: Tramo[]; carriles: number; etiqueta?: React.ReactNode }) => (
    <div
      className="grid border-t border-border relative"
      style={{ gridTemplateColumns: columnas, gridTemplateRows: `repeat(${carriles}, ${ALTO_CARRIL}px)` }}
    >
      <div
        style={{ gridColumn: 1, gridRow: "1 / -1" }}
        className="sticky left-0 z-20 bg-card px-3 py-1.5 border-r border-border flex flex-col justify-center min-w-0"
      >
        <span className="text-sm font-medium truncate">{nombre}</span>
        {etiqueta}
      </div>
      <Fondo />
      <Barras tramos={tramos} />
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Controles */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => setInicio(sumarDias(inicio, -7))} aria-label="Semana anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => setInicio(lunesDe(hoy))}>Hoy</Button>
          <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => setInicio(sumarDias(inicio, 7))} aria-label="Semana siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-2 text-sm font-medium">{rango}</span>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Ver
          <select
            value={totalDias}
            onChange={e => setTotalDias(Number(e.target.value))}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
          >
            <option value={14}>2 semanas</option>
            <option value={28}>4 semanas</option>
            <option value={42}>6 semanas</option>
          </select>
        </label>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-3 px-1 text-xs text-muted-foreground">
        {(["Pendiente OIO", "En ejecucion", "Para cierre", "Cerrada"] as EstadoObra[]).map(e => (
          <div key={e} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: COLOR_POR_ESTADO[e].bg }} />
            <span>{e === "En ejecucion" ? "En ejecución" : e}</span>
          </div>
        ))}
      </div>

      <div className="bg-card border rounded-lg overflow-x-auto">
        <div style={{ minWidth: ANCHO_NOMBRE + totalDias * ANCHO_DIA }}>
          {/* Encabezado de días */}
          <div className="grid" style={{ gridTemplateColumns: columnas }}>
            <div className="sticky left-0 z-20 bg-card px-3 py-2 border-r border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Técnico
            </div>
            {dias.map((d, i) => (
              <div
                key={i}
                className={cn(
                  "border-l border-border/60 py-1.5 text-center text-[11px] leading-tight",
                  (d.getDay() === 0 || d.getDay() === 6) && "bg-muted/30",
                  mismoDia(d, hoy) && "bg-primary/15 text-primary font-semibold",
                )}
              >
                <div className="text-muted-foreground">{DIAS_SEMANA[d.getDay()]}</div>
                <div>{d.getDate()}{d.getDate() === 1 || i === 0 ? <span className="block text-[9px] uppercase text-muted-foreground">{d.toLocaleDateString("es-AR", { month: "short" })}</span> : null}</div>
              </div>
            ))}
          </div>

          {filas.porTecnico.length === 0 && (
            <div className="border-t border-border px-4 py-8 text-center text-sm text-muted-foreground">
              No hay técnicos registrados.
            </div>
          )}

          {filas.porTecnico.map(f => (
            <Fila
              key={f.id}
              nombre={f.nombre}
              tramos={f.tramos}
              carriles={f.carriles}
              etiqueta={
                f.tramos.length === 0 ? (
                  <span className="text-[11px] text-success">Libre</span>
                ) : f.carriles > 1 ? (
                  <span className="text-[11px] text-warning flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> {f.carriles} obras a la vez
                  </span>
                ) : null
              }
            />
          ))}

          {filas.sinTecnico.cantidad > 0 && (
            <Fila
              nombre="Sin técnico asignado"
              tramos={filas.sinTecnico.tramos}
              carriles={filas.sinTecnico.carriles}
              etiqueta={<span className="text-[11px] text-muted-foreground">{filas.sinTecnico.cantidad} obra{filas.sinTecnico.cantidad > 1 ? "s" : ""}</span>}
            />
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground px-1">
        Tocá una obra para abrir su detalle. Las flechas ◂ ▸ indican que la obra sigue fuera de las fechas que se ven.
      </p>
    </div>
  );
}
