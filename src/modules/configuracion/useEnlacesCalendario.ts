import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

const KEY = "enlaces_calendario";

/** Dirección completa del calendario (la que se pega en Google Calendar) */
export function urlCalendario(token: string): string {
  const base = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, "");
  return `${base}/functions/v1/calendario-ics?t=${token}`;
}

/** Mi enlace personal (se crea la primera vez) */
export function useMiEnlaceCalendario() {
  return useQuery({
    queryKey: [KEY, "mio"],
    retry: false,
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase.rpc("mi_enlace_calendario");
      if (error) throw error;
      return data as string;
    },
  });
}

export function useRegenerarMiEnlace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("regenerar_enlace_calendario");
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, "mio"] }),
  });
}

/** Enlace del calendario central (Dirección, Operaciones y Contabilidad) */
export function useEnlaceCentral(habilitado: boolean) {
  return useQuery({
    queryKey: [KEY, "central"],
    enabled: habilitado,
    retry: false,
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase.rpc("enlace_calendario_central", { p_regenerar: false });
      if (error) throw error;
      return data as string;
    },
  });
}

export function useRegenerarEnlaceCentral() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("enlace_calendario_central", { p_regenerar: true });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, "central"] }),
  });
}
