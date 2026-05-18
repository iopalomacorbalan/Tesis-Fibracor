import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface GoogleCalendarConfig {
  id: number;
  calendar_id: string | null;
  habilitado: boolean;
  zona_horaria: string;
  updated_at: string;
}

export interface SyncLog {
  id: string;
  obra_id: string | null;
  obra_codigo: string | null;
  accion: string;
  resultado: string;
  google_event_id: string | null;
  error_msg: string | null;
  created_at: string;
}

const KEY = "google_calendar_config";

export function useGoogleConfig() {
  return useQuery({
    queryKey: [KEY],
    queryFn: async (): Promise<GoogleCalendarConfig | null> => {
      const { data, error } = await supabase
        .from("google_calendar_config")
        .select("*").eq("id", 1).maybeSingle();
      if (error) {
        console.warn("Error config google:", error.message);
        return null;
      }
      return data;
    },
  });
}

export function useActualizarGoogleConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<GoogleCalendarConfig>) => {
      const { error } = await supabase
        .from("google_calendar_config")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

/** Últimos logs de sincronización */
export function useSyncLogs(limit = 30) {
  return useQuery({
    queryKey: [KEY, "logs", limit],
    queryFn: async (): Promise<SyncLog[]> => {
      const { data, error } = await supabase
        .from("google_sync_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) {
        console.warn("Error logs sync:", error.message);
        return [];
      }
      return data ?? [];
    },
  });
}

/** Resincroniza una obra específica llamando a la Edge Function */
export function useResincronizarObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (obraId: string) => {
      const { data, error } = await supabase.functions.invoke("sync-google-calendar", {
        body: { obra_id: obraId, accion: "update" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ["obras"] });
    },
  });
}

/** Resincroniza todas las obras activas */
export function useResincronizarTodas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      // Buscar obras activas
      const { data: obras, error } = await supabase
        .from("obras")
        .select("id, obra_id, estado, fecha_inicio_est, fecha_inicio_real")
        .in("estado", ["Pendiente OIO", "En ejecucion", "Para cierre"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!obras || obras.length === 0) return { total: 0, ok: 0, errores: 0 };

      let ok = 0;
      let errores = 0;
      for (const o of obras) {
        if (!o.fecha_inicio_est && !o.fecha_inicio_real) continue;
        try {
          await supabase.functions.invoke("sync-google-calendar", {
            body: { obra_id: o.id, accion: "update" },
          });
          ok++;
        } catch (e) {
          console.warn("Error sync obra", o.obra_id, e);
          errores++;
        }
      }
      return { total: obras.length, ok, errores };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ["obras"] });
    },
  });
}
