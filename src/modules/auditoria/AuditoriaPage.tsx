import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, ShieldCheck, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useAuditoria, type RegistroAuditoria } from "./useAuditoria";

const TABLAS: Record<string, string> = {
  obras: "Obras", remitos: "Remitos", compras: "Compras", inventario: "Stock",
  caja_chica: "Caja chica", clientes: "Clientes", proveedores: "Proveedores", usuarios: "Usuarios",
};

const ACCIONES: Record<string, { label: string; clase: string }> = {
  INSERT: { label: "Alta", clase: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" },
  UPDATE: { label: "Modificación", clase: "bg-amber-500/10 text-amber-500 border-amber-500/30" },
  DELETE: { label: "Baja", clase: "bg-destructive/10 text-destructive border-destructive/30" },
};

const fmt = (v: unknown) =>
  v === null || v === undefined || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v);

function Detalle({ r }: { r: RegistroAuditoria }) {
  const cambios = r.cambios ?? {};
  const claves = Object.keys(cambios);
  if (claves.length === 0) return <p className="text-xs text-muted-foreground">Sin detalle.</p>;

  if (r.accion === "UPDATE") {
    return (
      <ul className="text-xs space-y-1">
        {claves.map(k => (
          <li key={k}>
            <b>{k}</b>:{" "}
            <span className="text-muted-foreground line-through">{fmt(cambios[k]?.antes)}</span>
            {" → "}
            <span>{fmt(cambios[k]?.despues)}</span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="text-xs space-y-1">
      {claves.filter(k => cambios[k] !== null).map(k => (
        <li key={k}><b>{k}</b>: {fmt(cambios[k])}</li>
      ))}
    </ul>
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
        <div className="space-y-2">
          {visibles.map(r => {
            const a = ACCIONES[r.accion];
            return (
              <Card key={r.id} className="cursor-pointer" onClick={() => setAbierto(abierto === r.id ? null : r.id)}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className={cn("px-2 py-0.5 rounded-md text-[11px] border", a.clase)}>{a.label}</span>
                    <b>{TABLAS[r.tabla] ?? r.tabla}</b>
                    {r.referencia && <span className="text-muted-foreground">{r.referencia}</span>}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {r.usuario_nombre ?? "Sistema"} · {new Date(r.created_at).toLocaleString("es-AR")}
                    </span>
                  </div>
                  {abierto === r.id && <Detalle r={r} />}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
