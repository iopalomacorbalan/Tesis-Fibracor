import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface HorasTecnicoObra {
  tecnico_id: string;
  tecnico_nombre: string;
  cantidad_reportes: number;
  total_horas: number;
  costo_total: number;
}

export interface TotalHorasObra {
  total_horas: number;
  cantidad_tecnicos: number;
  cantidad_reportes: number;
  costo_total: number;
  precio_hora_actual: number;
}

/** Trae el desglose por técnico */
export function useHorasTecnicasObra(obraId: string | null) {
  return useQuery({
    queryKey: ["obra_horas_tecnicas", obraId],
    enabled: !!obraId,
    queryFn: async (): Promise<HorasTecnicoObra[]> => {
      if (!obraId) return [];
      const { data, error } = await supabase.rpc("get_horas_tecnicas_obra", {
        p_obra_id: obraId,
      });
      if (error) {
        console.warn("Error horas técnicas:", error.message);
        return [];
      }
      return (data ?? []).map((h: any) => ({
        tecnico_id: h.tecnico_id,
        tecnico_nombre: h.tecnico_nombre,
        cantidad_reportes: Number(h.cantidad_reportes) || 0,
        total_horas: Number(h.total_horas) || 0,
        costo_total: Number(h.costo_total) || 0,
      }));
    },
  });
}

/** Trae el total general (horas, técnicos, costo) */
export function useTotalHorasObra(obraId: string | null) {
  return useQuery({
    queryKey: ["obra_horas_total", obraId],
    enabled: !!obraId,
    queryFn: async (): Promise<TotalHorasObra | null> => {
      if (!obraId) return null;
      const { data, error } = await supabase.rpc("get_total_horas_obra", {
        p_obra_id: obraId,
      });
      if (error) {
        console.warn("Error total horas:", error.message);
        return null;
      }
      const row = (data ?? [])[0];
      if (!row) return null;
      return {
        total_horas: Number(row.total_horas) || 0,
        cantidad_tecnicos: Number(row.cantidad_tecnicos) || 0,
        cantidad_reportes: Number(row.cantidad_reportes) || 0,
        costo_total: Number(row.costo_total) || 0,
        precio_hora_actual: Number(row.precio_hora_actual) || 0,
      };
    },
  });
}
