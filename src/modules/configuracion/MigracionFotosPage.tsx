import { useState } from "react";
import { Images, Loader2, AlertTriangle, CheckCircle2, Play, Download } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { comprimirImagen, generarMiniatura } from "@/lib/imagenes";

const BUCKET = "reportes-fotos";

interface FotoPendiente {
  id: string;
  url: string | null;
  storage_path: string;
  reporte_id: string;
}

interface Log {
  texto: string;
  tipo: "info" | "ok" | "error";
}

export default function MigracionFotosPage() {
  const { profile } = useAuth();
  const [corriendo, setCorriendo] = useState(false);
  const [logs, setLogs] = useState<Log[]>([]);
  const [progreso, setProgreso] = useState({ actual: 0, total: 0 });
  const [pendientes, setPendientes] = useState<number | null>(null);

  // Solo Dirección
  if (profile && profile.area !== "Direccion") return <Navigate to="/" replace />;

  const log = (texto: string, tipo: Log["tipo"] = "info") =>
    setLogs(prev => [...prev, { texto, tipo }]);

  const contarPendientes = async () => {
    const { count, error } = await supabase
      .from("reporte_fotos")
      .select("id", { count: "exact", head: true })
      .is("thumb_url", null);
    if (error) { toast.error("Error: " + error.message); return; }
    setPendientes(count ?? 0);
    toast.success(`${count ?? 0} fotos sin miniatura`);
  };

  const descargarBackup = async () => {
    const { data, error } = await supabase
      .from("reporte_fotos")
      .select("id, reporte_id, storage_path, url, thumb_url, thumb_path, caption");
    if (error) { toast.error("Error: " + error.message); return; }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `backup_reporte_fotos_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Backup descargado");
  };

  const migrar = async () => {
    if (!confirm(
      "Esto va a generar miniaturas para las fotos existentes.\n\n" +
      "IMPORTANTE: descargá el backup antes de continuar.\n\n" +
      "Las fotos originales NO se borran ni se modifican: solo se agrega una miniatura.\n\n" +
      "¿Continuar?"
    )) return;

    setCorriendo(true);
    setLogs([]);
    try {
      const { data, error } = await supabase
        .from("reporte_fotos")
        .select("id, url, storage_path, reporte_id")
        .is("thumb_url", null);
      if (error) throw error;

      const fotos = (data ?? []) as FotoPendiente[];
      setProgreso({ actual: 0, total: fotos.length });
      log(`Encontradas ${fotos.length} fotos sin miniatura`, "info");

      let ok = 0, fallos = 0;
      for (let i = 0; i < fotos.length; i++) {
        const foto = fotos[i];
        setProgreso({ actual: i + 1, total: fotos.length });
        try {
          if (!foto.url) { log(`Foto ${foto.id.slice(0, 8)}: sin URL, salteada`, "error"); fallos++; continue; }

          // Descargar la original
          const resp = await fetch(foto.url);
          if (!resp.ok) throw new Error("no se pudo descargar");
          const blob = await resp.blob();
          const file = new File([blob], `foto.jpg`, { type: blob.type || "image/jpeg" });

          // Generar miniatura
          const thumb = await generarMiniatura(file);
          if (!thumb) throw new Error("no se pudo generar miniatura");

          // Subir miniatura junto a la original
          const thumbPath = foto.storage_path.replace(/(\.[^.]+)?$/, "") + "_thumb.jpg";
          const { error: errUp } = await supabase.storage
            .from(BUCKET)
            .upload(thumbPath, thumb, { upsert: true });
          if (errUp) throw errUp;

          const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(thumbPath);

          // Guardar referencia
          const { error: errUpd } = await supabase
            .from("reporte_fotos")
            .update({ thumb_url: pub.publicUrl, thumb_path: thumbPath } as any)
            .eq("id", foto.id);
          if (errUpd) throw errUpd;

          ok++;
          if ((i + 1) % 10 === 0 || i === fotos.length - 1) {
            log(`Procesadas ${i + 1}/${fotos.length} — ${ok} ok, ${fallos} con error`, "info");
          }
        } catch (e: any) {
          fallos++;
          log(`Foto ${foto.id.slice(0, 8)}: ${e.message ?? e}`, "error");
        }
      }

      log(`TERMINADO — ${ok} miniaturas creadas, ${fallos} errores`, ok > 0 ? "ok" : "error");
      toast.success(`Migración terminada: ${ok} miniaturas`);
      await contarPendientes();
    } catch (e: any) {
      log("Error general: " + (e.message ?? e), "error");
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
          <Images className="h-8 w-8 text-primary" />
          Optimizar fotos existentes
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Genera miniaturas para las fotos ya subidas, para que las grillas carguen mucho más rápido.
        </p>
      </div>

      {/* Aviso */}
      <Card className="border-warning/40 bg-warning/5">
        <CardContent className="p-4 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <p className="font-medium">Antes de empezar</p>
            <p className="text-muted-foreground">
              Descargá el backup de la tabla de fotos. Este proceso <b>no borra ni modifica</b> las
              fotos originales: solo crea una miniatura adicional para cada una. Aun así,
              conviene tener el respaldo.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Acciones */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={descargarBackup} disabled={corriendo}>
              <Download className="h-4 w-4 mr-1" /> 1. Descargar backup
            </Button>
            <Button variant="outline" onClick={contarPendientes} disabled={corriendo}>
              2. Ver cuántas faltan
            </Button>
            <Button onClick={migrar} disabled={corriendo}>
              {corriendo ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
              3. Generar miniaturas
            </Button>
          </div>

          {pendientes !== null && !corriendo && (
            <p className="text-sm">
              {pendientes === 0
                ? <span className="text-success flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> Todas las fotos ya tienen miniatura</span>
                : <span><b>{pendientes}</b> fotos sin miniatura</span>}
            </p>
          )}

          {corriendo && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Procesando {progreso.actual} de {progreso.total}</span>
                <span>{pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">
                No cierres esta pestaña hasta que termine.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Log */}
      {logs.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-mono space-y-0.5 max-h-72 overflow-y-auto">
              {logs.map((l, i) => (
                <div key={i} className={
                  l.tipo === "error" ? "text-destructive" :
                  l.tipo === "ok" ? "text-success font-semibold" : "text-muted-foreground"
                }>
                  {l.texto}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
