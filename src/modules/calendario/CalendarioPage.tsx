import { useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, { type EventDropArg, type EventResizeDoneArg } from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import esLocale from "@fullcalendar/core/locales/es";
import type { EventInput, EventClickArg } from "@fullcalendar/core";
import { toast } from "sonner";
import { Calendar as CalendarIcon, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useObras } from "@/modules/obras/useObras";
import { ObraDetalle } from "@/modules/obras/ObraDetalle";
import { supabase } from "@/lib/supabase";
import type { EstadoObra } from "@/types/database";

const COLOR_POR_ESTADO: Record<EstadoObra, { bg: string; text: string; border: string }> = {
  "Pendiente OIO": { bg: "#FBBF24", text: "#78350F", border: "#D97706" },  // amarillo
  "En ejecucion":  { bg: "#34D399", text: "#064E3B", border: "#059669" },  // verde
  "Para cierre":   { bg: "#F87171", text: "#7F1D1D", border: "#DC2626" },  // rojo
  "Cerrada":       { bg: "#F87171", text: "#7F1D1D", border: "#DC2626" },  // rojo
  "Cancelada":     { bg: "#F87171", text: "#7F1D1D", border: "#DC2626" },  // rojo
};

export function CalendarioPage() {
  const { profile } = useAuth();
  const { data: obras = [], refetch, isLoading } = useObras();
  const [obraDetalleId, setObraDetalleId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const calendarRef = useRef<FullCalendar | null>(null);

  // Permisos
  const area = profile?.area;
  const puedeEditar = area && ["Direccion", "Operaciones", "Paniol", "Comercial"].includes(area);
  const esTecnico = area === "Tecnico";

  // Filtrar obras: técnicos solo ven las suyas
  const obrasVisibles = useMemo(() => {
    if (!profile) return [];
    if (esTecnico) {
      return obras.filter(o => o.tecnicos?.some(t => t.id === profile.id));
    }
    return obras;
  }, [obras, profile, esTecnico]);

  // Convertir obras a eventos de FullCalendar
  const eventos: EventInput[] = useMemo(() => {
    return obrasVisibles
      .filter(o => o.fecha_inicio_est) // solo obras con fecha
      .map(o => {
        const color = COLOR_POR_ESTADO[o.estado] ?? COLOR_POR_ESTADO["En ejecucion"];
        // FullCalendar usa "end" como EXCLUSIVO. Sumamos 1 día para que abarque el día final completo.
        let endDate = o.fecha_fin_est ?? o.fecha_inicio_est;
        if (endDate) {
          const d = new Date(endDate + "T00:00:00");
          d.setDate(d.getDate() + 1);
          endDate = d.toISOString().slice(0, 10);
        }
        return {
          id: o.id,
          title: `${o.codigo} — ${o.nombre}`,
          start: o.fecha_inicio_est!,
          end: endDate ?? undefined,
          backgroundColor: color.bg,
          borderColor: color.border,
          textColor: color.text,
          allDay: true,
          editable: puedeEditar && o.estado !== "Cerrada" && o.estado !== "Cancelada",
          extendedProps: {
            obra: o,
          },
        };
      });
  }, [obrasVisibles, puedeEditar]);

  // Cuando arrastrás o redimensionás una obra
  const guardarCambio = async (eventId: string, start: Date, end: Date | null) => {
    setSaving(true);
    try {
      // FullCalendar entrega "end" exclusivo, restamos 1 día para guardar el día final inclusivo
      const startISO = toLocalDate(start);
      let endISO: string | null = null;
      if (end) {
        const d = new Date(end);
        d.setDate(d.getDate() - 1);
        endISO = toLocalDate(d);
      }
      const { error } = await supabase
        .from("obras")
        .update({
          fecha_inicio_est: startISO,
          fecha_fin_est: endISO ?? startISO,
        })
        .eq("id", eventId);
      if (error) throw error;
      toast.success("Fechas actualizadas");
      await refetch();
    } catch (e: any) {
      toast.error("Error al actualizar: " + e.message);
      // Revertir visualmente
      await refetch();
    } finally {
      setSaving(false);
    }
  };

  const handleEventDrop = (info: EventDropArg) => {
    if (!info.event.start) return;
    guardarCambio(info.event.id, info.event.start, info.event.end);
  };

  const handleEventResize = (info: EventResizeDoneArg) => {
    if (!info.event.start) return;
    guardarCambio(info.event.id, info.event.start, info.event.end);
  };

  const handleEventClick = (info: EventClickArg) => {
    setObraDetalleId(info.event.id);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Calendario de obras</h1>
          <p className="text-sm text-muted-foreground">
            {esTecnico
              ? "Tus obras asignadas con sus fechas estimadas"
              : puedeEditar
              ? "Arrastrá las obras para cambiar fechas. Click para ver detalle."
              : "Vista general de todas las obras"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading || saving}>
          <RefreshCw className={`h-4 w-4 mr-1 ${(isLoading || saving) ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-3 px-1 text-xs text-muted-foreground">
        <LegendDot color="#FBBF24" label="Pendiente OIO" />
        <LegendDot color="#34D399" label="En ejecución" />
        <LegendDot color="#F87171" label="Cerrada / Cancelada" />
      </div>

      <div className="bg-card border rounded-lg p-2 sm:p-4 overflow-hidden">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locale={esLocale}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,listMonth",
          }}
          buttonText={{
            today: "Hoy",
            month: "Mes",
            week: "Semana",
            list: "Lista",
          }}
          events={eventos}
          editable={puedeEditar}
          eventStartEditable={puedeEditar}
          eventDurationEditable={puedeEditar}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
          eventClick={handleEventClick}
          height="auto"
          firstDay={1} // Lunes
          weekends={true}
          dayMaxEvents={3}
          moreLinkText={(n) => `+${n} más`}
          eventTimeFormat={{ hour: "2-digit", minute: "2-digit" }}
          eventDisplay="block"
        />
      </div>

      {/* Modal de detalle de obra (reusa el existente) */}
      <ObraDetalle
        open={obraDetalleId !== null}
        onOpenChange={(o) => { if (!o) setObraDetalleId(null); }}
        obraId={obraDetalleId}
      />
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
      <span>{label}</span>
    </div>
  );
}

/** Convierte Date local a "YYYY-MM-DD" sin zona horaria UTC. */
function toLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
