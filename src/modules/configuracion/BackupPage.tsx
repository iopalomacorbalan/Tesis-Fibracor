import { useState } from "react";
import { HardDriveDownload, Loader2, CheckCircle2, AlertTriangle, Database, Images } from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

/** Todas las tablas del sistema */
const TABLAS = [
  "usuarios", "clientes", "proveedores", "obras", "obra_tecnicos",
  "reportes", "reporte_fotos", "reporte_tecnicos",
  "inventario", "movimientos",
  "solicitudes", "solicitud_items",
  "compras", "compra_items",
  "remitos", "remito_items",
  "costos_extras_obra",
  "caja_chica", "caja_chica_movimientos",
  "configuracion_global", "google_calendar_config", "google_sync_log",
];

const BUCKETS = ["reportes-fotos", "caja-chica"];

interface Log { texto: string; tipo: "info" | "ok" | "error" }

export default function BackupPage() {
  const { profile } = useAuth();
  const [corriendo, setCorriendo] = useState(false);
  const [logs, setLogs] = useState<Log[]>([]);
  const [progreso, setProgreso] = useState({ actual: 0, total: 0, etapa: "" });

  if (profile && profile.area !== "Direccion") return <Navigate to="/" replace />;

  const log = (texto: string, tipo: Log["tipo"] = "info") =>
    setLogs(prev => [...prev, { texto, tipo }]);

  /** Backup solo de datos (rápido, sin fotos) */
  const backupDatos = async () => {
    setCorriendo(true);
    setLogs([]);
    try {
      const zip = new JSZip();
      const carpeta = zip.folder("datos")!;
      setProgreso({ actual: 0, total: TABLAS.length, etapa: "Datos" });
      log("Descargando tablas...");

      let filasTotales = 0;
      for (let i = 0; i < TABLAS.length; i++) {
        const tabla = TABLAS[i];
        setProgreso({ actual: i + 1, total: TABLAS.length, etapa: "Datos" });
        const { data, error } = await supabase.from(tabla).select("*");
        if (error) {
          log(`${tabla}: ${error.message}`, "error");
          continue;
        }
        const filas = data?.length ?? 0;
        filasTotales += filas;
        carpeta.file(`${tabla}.json`, JSON.stringify(data ?? [], null, 2));
        log(`${tabla}: ${filas} filas`, "ok");
      }

      zip.file("INFO.txt", infoTexto(filasTotales, false));
      log("Comprimiendo...");
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
      descargar(blob, `backup_datos_${fechaHoy()}.zip`);
      log(`LISTO — ${filasTotales} filas en total`, "ok");
      toast.success("Backup de datos descargado");
    } catch (e: any) {
      log("Error: " + (e.message ?? e), "error");
      toast.error("Error: " + e.message);
    } finally {
      setCorriendo(false);
    }
  };

  /** Backup completo: datos + todos los archivos de storage */
  const backupCompleto = async () => {
    if (!confirm(
      "Backup COMPLETO: descarga todos los datos y todas las fotos.\n\n" +
      "Puede tardar varios minutos y generar un archivo grande.\n" +
      "No cierres la pestaña hasta que termine.\n\n" +
      "¿Continuar?"
    )) return;

    setCorriendo(true);
    setLogs([]);
    try {
      const zip = new JSZip();

      // ===== 1. Datos =====
      const carpetaDatos = zip.folder("datos")!;
      setProgreso({ actual: 0, total: TABLAS.length, etapa: "Datos" });
      log("=== DATOS ===");
      let filasTotales = 0;
      const cache: Record<string, any[]> = {};
      for (let i = 0; i < TABLAS.length; i++) {
        const tabla = TABLAS[i];
        setProgreso({ actual: i + 1, total: TABLAS.length, etapa: "Datos" });
        const { data, error } = await supabase.from(tabla).select("*");
        if (error) { log(`${tabla}: ${error.message}`, "error"); continue; }
        filasTotales += data?.length ?? 0;
        cache[tabla] = data ?? [];
        carpetaDatos.file(`${tabla}.json`, JSON.stringify(data ?? [], null, 2));
      }
      log(`${filasTotales} filas descargadas`, "ok");

      // ===== 2. Índices para nombrar las carpetas =====
      const clientesPorId = new Map((cache["clientes"] ?? []).map((c: any) => [c.id, c]));
      const obrasPorId = new Map((cache["obras"] ?? []).map((o: any) => [o.id, o]));
      const usuariosPorId = new Map((cache["usuarios"] ?? []).map((u: any) => [u.id, u]));
      const reportesPorId = new Map((cache["reportes"] ?? []).map((r: any) => [r.id, r]));
      const fotos = cache["reporte_fotos"] ?? [];

      // storage_path → { rutaLegible, datos para el CSV }
      const mapaFotos = new Map<string, { ruta: string; fila: string[] }>();
      const filasCsv: string[][] = [];

      fotos.forEach((f: any, idx: number) => {
        const rep = reportesPorId.get(f.reporte_id);
        const obra = rep ? obrasPorId.get(rep.obra_id) : null;
        const cli = obra?.cliente_id ? clientesPorId.get(obra.cliente_id) : null;
        const tec = rep?.tecnico_id ? usuariosPorId.get(rep.tecnico_id) : null;

        const nomCliente = limpiar(cli?.nombre ?? "Sin cliente");
        const nomObra = limpiar(obra ? `${obra.obra_id} - ${obra.nombre_obra ?? ""}`.trim() : "Sin obra");
        const nomReporte = limpiar(rep ? `${rep.reporte_id}_${rep.fecha ?? ""}`.trim() : "Sin reporte");

        // Extensión original + numeración por reporte
        const ext = (f.storage_path?.split(".").pop() ?? "jpg").toLowerCase();
        const esThumb = f.storage_path?.includes("_thumb");
        const nombreArchivo = `foto-${idx + 1}${esThumb ? "_thumb" : ""}.${ext}`;
        const ruta = `${nomCliente}/${nomObra}/${nomReporte}/${nombreArchivo}`;

        if (f.storage_path) {
          mapaFotos.set(f.storage_path, {
            ruta,
            fila: [
              cli?.nombre ?? "", obra?.obra_id ?? "", obra?.nombre_obra ?? "",
              rep?.reporte_id ?? "", rep?.fecha ?? "", tec?.nombre ?? "",
              nombreArchivo, f.caption ?? "", f.url ?? "",
            ],
          });
        }
      });

      // ===== 3. Archivos de storage =====
      log("=== ARCHIVOS ===");
      let archivosOk = 0, archivosError = 0;

      for (const bucket of BUCKETS) {
        log(`Bucket: ${bucket}`);
        const rutas = await listarArchivos(bucket);
        log(`  ${rutas.length} archivos encontrados`);
        setProgreso({ actual: 0, total: rutas.length, etapa: bucket });

        for (let i = 0; i < rutas.length; i++) {
          setProgreso({ actual: i + 1, total: rutas.length, etapa: bucket });
          const ruta = rutas[i];
          try {
            const { data, error } = await supabase.storage.from(bucket).download(ruta);
            if (error || !data) throw error ?? new Error("sin datos");

            // Para fotos de reportes usamos la ruta legible; el resto va tal cual
            let destino: string;
            if (bucket === "reportes-fotos") {
              const info = mapaFotos.get(ruta);
              if (info) {
                destino = `archivos/reportes/${info.ruta}`;
                filasCsv.push(info.fila);
              } else {
                // Foto en storage sin registro en la base
                destino = `archivos/reportes/_sin_referencia/${ruta}`;
              }
            } else {
              destino = `archivos/${bucket}/${ruta}`;
            }

            zip.file(destino, data);
            archivosOk++;
          } catch (e: any) {
            archivosError++;
            log(`  ✗ ${ruta}: ${e.message ?? e}`, "error");
          }
          if ((i + 1) % 25 === 0) log(`  ${i + 1}/${rutas.length}...`);
        }
      }
      log(`${archivosOk} archivos descargados, ${archivosError} con error`, archivosError > 0 ? "error" : "ok");

      // ===== 4. Índice CSV de fotos =====
      if (filasCsv.length > 0) {
        const encabezado = ["Cliente", "Codigo obra", "Nombre obra", "Reporte", "Fecha", "Tecnico", "Archivo", "Descripcion", "URL original"];
        const csv = [encabezado, ...filasCsv]
          .map(fila => fila.map(celda => `"${String(celda ?? "").replace(/"/g, '""')}"`).join(","))
          .join("\r\n");
        // BOM para que Excel abra bien los acentos
        zip.file("INDICE_FOTOS.csv", "\uFEFF" + csv);
        log(`Índice CSV con ${filasCsv.length} fotos`, "ok");
      }

      // ===== 3. Comprimir =====
      zip.file("INFO.txt", infoTexto(filasTotales, true, archivosOk));
      log("Comprimiendo (puede tardar)...");
      setProgreso({ actual: 0, total: 0, etapa: "Comprimiendo" });
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
      descargar(blob, `backup_completo_${fechaHoy()}.zip`);
      log("LISTO — backup completo descargado", "ok");
      toast.success("Backup completo descargado");
    } catch (e: any) {
      log("Error: " + (e.message ?? e), "error");
      toast.error("Error: " + e.message);
    } finally {
      setCorriendo(false);
    }
  };

  const pct = progreso.total > 0 ? Math.round((progreso.actual / progreso.total) * 100) : 0;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
          <HardDriveDownload className="h-8 w-8 text-primary" />
          Copia de seguridad
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Descargá un respaldo de todos los datos y archivos del sistema.
        </p>
      </div>

      <Card className="border-warning/40 bg-warning/5">
        <CardContent className="p-4 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            El archivo contiene datos de clientes, empleados y proveedores.
            Guardalo en un lugar seguro y no lo subas a servicios públicos.
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              <span className="font-semibold">Solo datos</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Todas las tablas en formato JSON. Rápido y liviano. No incluye las fotos.
            </p>
            <Button className="w-full" variant="outline" onClick={backupDatos} disabled={corriendo}>
              {corriendo ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Descargar datos
            </Button>
          </CardContent>
        </Card>

        <Card className="border-primary/30">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Images className="h-5 w-5 text-primary" />
              <span className="font-semibold">Backup completo</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Datos + todas las fotos, organizadas por cliente, obra y reporte.
              Incluye índice en Excel. Tarda más y pesa bastante.
            </p>
            <Button className="w-full" onClick={backupCompleto} disabled={corriendo}>
              {corriendo ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Descargar todo
            </Button>
          </CardContent>
        </Card>
      </div>

      {corriendo && (
        <Card>
          <CardContent className="p-4 space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{progreso.etapa}{progreso.total > 0 && `: ${progreso.actual} de ${progreso.total}`}</span>
              {progreso.total > 0 && <span>{pct}%</span>}
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className={cn("h-full bg-primary transition-all", progreso.total === 0 && "animate-pulse w-full")}
                style={progreso.total > 0 ? { width: `${pct}%` } : undefined} />
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              No cierres esta pestaña hasta que termine.
            </p>
          </CardContent>
        </Card>
      )}

      {logs.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-mono space-y-0.5 max-h-80 overflow-y-auto">
              {logs.map((l, i) => (
                <div key={i} className={
                  l.tipo === "error" ? "text-destructive" :
                  l.tipo === "ok" ? "text-success" : "text-muted-foreground"
                }>{l.texto}</div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Cuándo hacer backup
          </p>
          <p>• Antes de correr cualquier migración SQL</p>
          <p>• Antes de borrar datos o usuarios</p>
          <p>• Como rutina: una vez por semana o por mes</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ===== helpers =====

/** Limpia un texto para usarlo como nombre de carpeta/archivo */
function limpiar(texto: string): string {
  return (texto || "")
    .replace(/[\\/:*?"<>|]/g, "-")   // caracteres inválidos en Windows
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "Sin nombre";
}

/** Lista recursivamente todos los archivos de un bucket */
async function listarArchivos(bucket: string, prefijo = ""): Promise<string[]> {
  const rutas: string[] = [];
  const { data, error } = await supabase.storage.from(bucket).list(prefijo, {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });
  if (error || !data) return rutas;

  for (const item of data) {
    const ruta = prefijo ? `${prefijo}/${item.name}` : item.name;
    // Las carpetas vienen sin metadata; los archivos sí la tienen
    if (item.id === null || item.metadata === null) {
      const hijos = await listarArchivos(bucket, ruta);
      rutas.push(...hijos);
    } else {
      rutas.push(ruta);
    }
  }
  return rutas;
}

function descargar(blob: Blob, nombre: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function fechaHoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function infoTexto(filas: number, conArchivos: boolean, archivos = 0) {
  return [
    "BACKUP FIBRACOR",
    `Fecha: ${new Date().toLocaleString("es-AR")}`,
    "",
    `Tablas: ${TABLAS.length}`,
    `Filas totales: ${filas}`,
    conArchivos ? `Archivos: ${archivos}` : "Archivos: no incluidos (backup solo de datos)",
    "",
    "CONTENIDO",
    "  datos/                    → una tabla por archivo JSON",
    conArchivos ? "  archivos/reportes/        → Cliente / Obra / Reporte / fotos" : "",
    conArchivos ? "  archivos/caja-chica/      → comprobantes de gastos" : "",
    conArchivos ? "  INDICE_FOTOS.csv          → listado de fotos con obra, fecha y técnico" : "",
    "",
    conArchivos ? "Las fotos están organizadas por cliente, obra y reporte para" : "",
    conArchivos ? "que sean fáciles de encontrar. El CSV se abre con Excel." : "",
    conArchivos ? "" : "",
    "NOTA: este backup NO incluye las contraseñas de los usuarios",
    "(están en Supabase Auth). Los usuarios y sus datos sí están",
    "en datos/usuarios.json.",
    "",
    "Guardar en lugar seguro. Contiene datos personales.",
  ].filter(l => l !== null && l !== undefined).join("\n");
}
