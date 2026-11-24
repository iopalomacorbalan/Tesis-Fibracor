import { useState } from "react";
import { CalendarCheck, Check, Copy, Info, Link2, Loader2, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import {
  urlCalendario, useMiEnlaceCalendario, useRegenerarMiEnlace,
  useEnlaceCentral, useRegenerarEnlaceCentral,
} from "./useEnlacesCalendario";

function EnlaceCopiable({ token, regenerar, regenerando, aviso }: {
  token: string | undefined;
  regenerar: () => void;
  regenerando: boolean;
  aviso: string;
}) {
  const [copiado, setCopiado] = useState(false);
  const url = token ? urlCalendario(token) : "";

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("No se pudo copiar. Seleccioná el texto y copialo a mano.");
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
        <Button type="button" onClick={copiar} disabled={!url}>
          {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copiado ? "Copiado" : "Copiar"}
        </Button>
      </div>
      <button
        type="button"
        onClick={() => {
          if (confirm(aviso)) regenerar();
        }}
        disabled={regenerando}
        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        {regenerando ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        Generar un enlace nuevo (el anterior deja de funcionar)
      </button>
    </div>
  );
}

const PASOS = [
  { titulo: "Copiá tu enlace", detalle: "Con el botón de arriba." },
  { titulo: "Abrí Google Calendar en una computadora", detalle: "Entrá a calendar.google.com. Desde el celular no se puede agregar por enlace." },
  { titulo: "Elegí “Desde URL”", detalle: "A la izquierda, junto a “Otros calendarios”, tocá el + y elegí “Desde URL”." },
  { titulo: "Pegá el enlace y agregalo", detalle: "Tocá “Agregar calendario”. También se va a ver en el Google Calendar de tu celular." },
];

export default function MiGoogleCalendarPage() {
  const { profile } = useAuth();
  const veCentral = ["Direccion", "Operaciones", "Contabilidad"].includes(profile?.area ?? "");

  const { data: mio, isLoading, error } = useMiEnlaceCalendario();
  const regenerarMio = useRegenerarMiEnlace();
  const { data: central } = useEnlaceCentral(veCentral);
  const regenerarCentral = useRegenerarEnlaceCentral();

  const regenerar = (fn: () => Promise<unknown>) => async () => {
    try {
      await fn();
      toast.success("Enlace nuevo generado. Volvé a suscribirte con el enlace nuevo.");
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <CalendarCheck className="h-8 w-8 text-primary" />
          Mi Google Calendar
        </h1>
        <p className="text-muted-foreground mt-1">
          Suscribite una sola vez y las obras que te asignen aparecen solas en tu calendario, con sus fechas.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
        {/* ───────── Columna principal: mi calendario ───────── */}
        <div className="xl:col-span-3 space-y-6">
          <Card>
            <CardContent className="p-5 sm:p-6 space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Link2 className="h-4 w-4" /> Tu enlace personal
              </h2>
              {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
                </div>
              ) : error ? (
                <p className="text-sm text-destructive">
                  No se pudo cargar tu enlace. Avisá a Dirección (falta correr el SQL 071).
                </p>
              ) : (
                <EnlaceCopiable
                  token={mio}
                  regenerar={regenerar(() => regenerarMio.mutateAsync())}
                  regenerando={regenerarMio.isPending}
                  aviso="¿Generar un enlace nuevo? El que ya usás en tu calendario va a dejar de funcionar y tendrás que suscribirte de nuevo."
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 sm:p-6 space-y-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Cómo suscribirte en Google Calendar
              </h2>
              <ol className="space-y-4">
                {PASOS.map((p, i) => (
                  <li key={p.titulo} className="flex gap-4">
                    <span className="h-7 w-7 shrink-0 rounded-full bg-primary/15 text-primary text-sm font-semibold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <div>
                      <div className="font-medium leading-7">{p.titulo}</div>
                      <div className="text-sm text-muted-foreground">{p.detalle}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        {/* ───────── Columna lateral: central y avisos ───────── */}
        <div className="xl:col-span-2 space-y-6">
          {veCentral && (
            <Card>
              <CardContent className="p-5 sm:p-6 space-y-4">
                <div className="space-y-1">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Users className="h-4 w-4" /> Calendario central de técnicos
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Un evento por técnico y obra, para ver de un vistazo qué obra tiene cada uno y en qué
                    fechas. Se suscribe igual que el personal.
                  </p>
                </div>
                <EnlaceCopiable
                  token={central}
                  regenerar={regenerar(() => regenerarCentral.mutateAsync())}
                  regenerando={regenerarCentral.isPending}
                  aviso="¿Generar un enlace central nuevo? El anterior va a dejar de funcionar para todos los que lo usan."
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-5 sm:p-6 space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Info className="h-4 w-4" /> Bueno saber
              </h2>
              <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
                <li>Google actualiza los calendarios suscritos cada varias horas: una obra nueva puede tardar en aparecer.</li>
                <li>Los eventos son de día completo y no se pueden editar desde el calendario.</li>
                <li>No compartas tu enlace: quien lo tenga ve tus obras.</li>
                <li>Si se filtró, generá uno nuevo y el anterior deja de funcionar.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
