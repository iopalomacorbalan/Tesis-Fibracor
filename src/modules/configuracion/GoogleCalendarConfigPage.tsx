import { useState, useEffect } from "react";
import { Calendar, Loader2, Check, AlertCircle, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { Navigate } from "react-router-dom";
import { formatDate } from "@/lib/utils";
import {
  useGoogleConfig, useActualizarGoogleConfig,
  useSyncLogs, useResincronizarTodas,
} from "./useGoogleCalendar";

export default function GoogleCalendarConfigPage() {
  const { profile } = useAuth();
  const { data: config, isLoading } = useGoogleConfig();
  const { data: logs = [] } = useSyncLogs(20);
  const actualizar = useActualizarGoogleConfig();
  const resyncTodas = useResincronizarTodas();

  const [calendarId, setCalendarId] = useState("");
  const [habilitado, setHabilitado] = useState(false);

  useEffect(() => {
    if (config) {
      setCalendarId(config.calendar_id ?? "");
      setHabilitado(config.habilitado ?? false);
    }
  }, [config]);

  // Solo Direccion
  if (profile && profile.area !== "Direccion") {
    return <Navigate to="/" replace />;
  }

  const handleGuardar = async () => {
    try {
      await actualizar.mutateAsync({
        calendar_id: calendarId.trim() || null,
        habilitado,
      });
      toast.success("Configuración guardada");
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  const handleResyncTodas = async () => {
    if (!confirm("¿Resincronizar todas las obras activas con Google Calendar? Puede tardar un rato.")) return;
    try {
      const r = await resyncTodas.mutateAsync();
      toast.success(`Resincronizadas ${r.ok}/${r.total} obras (${r.errores} con error)`);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  if (isLoading) {
    return <div className="py-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
          <Calendar className="h-8 w-8 text-primary" />
          Sincronización Google Calendar
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Cada obra con fechas se replica automáticamente en el calendar central de Google.
        </p>
      </div>

      {/* Configuración */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <h2 className="text-lg font-semibold">Configuración</h2>

          <div className="space-y-2">
            <Label>Calendar ID de Google</Label>
            <Input
              placeholder="ej: abc123...@group.calendar.google.com"
              value={calendarId}
              onChange={(e) => setCalendarId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Lo encontrás en Google Calendar → Configuración del calendar → sección "Integrar calendario".
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={habilitado}
                onChange={(e) => setHabilitado(e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-sm font-medium">Sincronización activa</span>
            </label>
            {habilitado ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/30">
                <Check className="h-3 w-3 inline mr-1" />Activa
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">
                Inactiva
              </span>
            )}
          </div>

          <div className="flex gap-2 flex-wrap pt-2 border-t">
            <Button onClick={handleGuardar} disabled={actualizar.isPending}>
              {actualizar.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Guardar
            </Button>
            <Button
              variant="outline"
              onClick={handleResyncTodas}
              disabled={resyncTodas.isPending || !habilitado || !calendarId}
            >
              {resyncTodas.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Resincronizar todas las obras activas
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Aviso de setup */}
      {!habilitado && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-4">
            <div className="flex gap-2">
              <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
              <div className="text-sm space-y-1">
                <p className="font-medium">Antes de activar:</p>
                <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-0.5">
                  <li>Pegá el Calendar ID arriba</li>
                  <li>Verificá que en Supabase está el secret <code className="bg-muted px-1">GOOGLE_SERVICE_ACCOUNT_JSON</code></li>
                  <li>Tildá "Sincronización activa" y guardá</li>
                  <li>Probá editando alguna obra y revisá si aparece en Google Calendar</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Logs */}
      <Card>
        <CardContent className="p-4">
          <h2 className="text-lg font-semibold mb-3">Últimas sincronizaciones</h2>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-4 text-center">
              Aún no hay registros de sincronización
            </p>
          ) : (
            <div className="space-y-1">
              {logs.map(l => (
                <div key={l.id} className="flex items-center gap-2 text-xs py-1.5 border-b last:border-0">
                  <span className="text-muted-foreground w-32 shrink-0">
                    {formatDate(l.created_at)}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] w-16 text-center shrink-0 ${
                    l.resultado === "ok" ? "bg-success/15 text-success" :
                    l.resultado === "error" ? "bg-destructive/15 text-destructive" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {l.resultado === "ok" ? <Check className="h-3 w-3 inline" /> :
                     l.resultado === "error" ? <X className="h-3 w-3 inline" /> : "skip"}
                  </span>
                  <span className="font-mono w-16 shrink-0">{l.accion}</span>
                  <span className="font-mono w-24 shrink-0 text-muted-foreground">
                    {l.obra_codigo ?? "—"}
                  </span>
                  {l.error_msg && (
                    <span className="text-destructive truncate" title={l.error_msg}>
                      {l.error_msg}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
