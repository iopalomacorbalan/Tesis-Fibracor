import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ExternalLink, Loader2, ShieldCheck, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useAuditoria, type RegistroAuditoria } from "./useAuditoria";
import { etiqueta, esTecnico, formatear, ordenar } from "./formato";
import { Paginacion, usePaginacion } from "@/components/ui/paginacion";

const TABLAS: Record<string, string> = {
  obras: "Obras", reportes: "Reportes", solicitudes: "Solicitudes", remitos: "Remitos", compras: "Compras",
  inventario: "Stock", caja_chica: "Caja chica", clientes: "Clientes", proveedores: "Proveedores", usuarios: "Usuarios",
};

const ACCIONES: Record<string, { label: string; clase: string }> = {
  INSERT: { label: "Alta", clase: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" },
  UPDATE: { label: "Modificación", clase: "bg-amber-500/10 text-amber-500 border-amber-500/30" },
  DELETE: { label: "Baja", clase: "bg-destructive/10 text-destructive border-destructive/30" },
};

const RUTAS_MODULO: Record<string, string> = {
  remitos: "/remitos", compras: "/compras", inventario: "/stock",
  caja_chica: "/caja-chica", clientes: "/crm", proveedores: "/crm", usuarios: "/usuarios",
  reportes: "/reportes", solicitudes: "/solicitudes",
};

/** A dónde lleva el código del registro. Las obras abren su ficha; el resto, su módulo. Un registro borrado ya no existe. */
function rutaDestino(r: RegistroAuditoria): string | null {
  if (r.accion === "DELETE") return null;
  if (r.tabla === "obras") return r.registro_id ? `/obras/${r.registro_id}` : null;
  return RUTAS_MODULO[r.tabla] ?? null;
}

function Valor({ clave, valor }: { clave: string; valor: unknown }) {
  const { texto, enlace } = formatear(clave, valor);
  return enlace
    ? <a href={enlace} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-primary hover:underline">{texto}</a>
    : <span className="break-words">{texto}</span>;
}

function Detalle({ r }: { r: RegistroAuditoria }) {
  const [tecnico, setTecnico] = useState(false);
  const cambios = r.cambios ?? {};
  const todas = Object.keys(cambios);
  if (todas.length === 0) return <p className="text-xs text-muted-foreground">Sin detalle.</p>;

  const esUpdate = r.accion === "UPDATE";
  // el valor "de referencia" de cada campo: en una modificación, el nuevo; en alta o baja, el único
  const ref = (k: string) => (esUpdate ? cambios[k]?.despues : cambios[k]);
  const visibles = ordenar(todas.filter(k => !esTecnico(k, ref(k)) && (esUpdate || cambios[k] !== null)));
  const ocultos = todas.length - visibles.length;
  const contexto = Object.entries(r.contexto ?? {});

  return (
    <div className="space-y-2 text-sm" onClick={(e) => e.stopPropagation()}>
      {visibles.length === 0 && contexto.length === 0 ? (
        <p className="text-xs text-muted-foreground">Solo cambiaron datos internos del sistema.</p>
      ) : (
        <dl className="grid grid-cols-[minmax(110px,170px)_1fr] gap-x-4 gap-y-1.5">
          {/* A qué obra, reporte, técnico… pertenece este movimiento, en palabras */}
          {contexto.map(([k, v]) => (
            <div key={"ctx-" + k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
          {visibles.map(k => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{etiqueta(k)}</dt>
              <dd>
                {esUpdate ? (
                  <>
                    <span className="text-muted-foreground line-through"><Valor clave={k} valor={cambios[k]?.antes} /></span>
                    <span className="mx-1.5 text-muted-foreground">→</span>
                    <b className="font-medium"><Valor clave={k} valor={cambios[k]?.despues} /></b>
                  </>
                ) : (
                  <Valor clave={k} valor={cambios[k]} />
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {ocultos > 0 && (
        <button type="button" onClick={() => setTecnico(t => !t)} className="text-xs text-primary hover:underline">
          {tecnico ? "Ocultar datos técnicos" : `Ver datos técnicos (${ocultos})`}
        </button>
      )}
      {tecnico && (
        <pre className="text-[11px] leading-snug bg-secondary/40 rounded-md p-2 overflow-x-auto whitespace-pre-wrap break-all">
          {JSON.stringify(cambios, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function AuditoriaPage() {
  const { profile } = useAuth();
  const [tabla, setTabla] = useState("todas");
  const [accion, setAccion] = useState("todas");
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState<number | null>(null);
  const { data = [], isLoading, error } = useAuditoria({ tabla, accion });

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return data;
    return data.filter(r =>
      (r.usuario_nombre ?? "").toLowerCase().includes(q) || (r.referencia ?? "").toLowerCase().includes(q),
    );
  }, [data, busqueda]);

  const pag = usePaginacion(visibles, `${tabla}|${accion}|${busqueda}`);

  if (profile && profile.area !== "Direccion") return <Navigate to="/" replace />;

  const selectCls = "h-9 rounded-md border border-input bg-background px-3 text-sm";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-primary" />
          Auditoría
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Quién creó, modificó o borró registros. Se muestran los últimos 300 movimientos.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por usuario o código..."
            className="pl-9"
          />
        </div>
        <select className={selectCls} value={tabla} onChange={(e) => setTabla(e.target.value)}>
          <option value="todas">Todos los módulos</option>
          {Object.entries(TABLAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className={selectCls} value={accion} onChange={(e) => setAccion(e.target.value)}>
          <option value="todas">Todas las acciones</option>
          {Object.entries(ACCIONES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="py-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
      ) : error ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          No se pudo cargar la auditoría. ¿Se corrió <code>sql/067_auditoria.sql</code>?
        </CardContent></Card>
      ) : visibles.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          No hay movimientos con esos filtros.
        </CardContent></Card>
      ) : (
      <>
        <div className="space-y-2">
          {pag.items.map(r => {
            const a = ACCIONES[r.accion];
            return (
              <Card key={r.id} className="cursor-pointer" onClick={() => setAbierto(abierto === r.id ? null : r.id)}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className={cn("px-2 py-0.5 rounded-md text-[11px] border", a.clase)}>{a.label}</span>
                    <b>{TABLAS[r.tabla] ?? etiqueta(r.tabla)}</b>
                    {r.referencia && (() => {
                      const destino = rutaDestino(r);
                      return destino ? (
                        <Link
                          to={destino}
                          onClick={(e) => e.stopPropagation()}
                          className="text-primary hover:underline inline-flex items-center gap-1"
                          title="Abrir"
                        >
                          {r.referencia}<ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">{r.referencia}</span>
                      );
                    })()}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {r.usuario_nombre ?? "Sistema"} · {new Date(r.created_at).toLocaleString("es-AR")}
                    </span>
                  </div>
                  {abierto !== r.id && r.contexto && Object.keys(r.contexto).length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {Object.entries(r.contexto).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                    </div>
                  )}
                  {abierto === r.id && <Detalle r={r} />}
                </CardContent>
              </Card>
            );
          })}
        </div>
        <Paginacion {...pag.controles} />
      </>
      )}
    </div>
  );
}
