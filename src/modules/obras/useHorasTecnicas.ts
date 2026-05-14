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

export interface HorasPorDia {
  reporte_id: string;
  reporte_codigo: string;
  fecha: string;
  hora_entrada: string;
  hora_salida: string;
  horas_dia: number;
  cantidad_asistentes: number;
  asistentes: Array<{ id: string; nombre: string; area: string }>;
  costo_dia: number;
}

/** Trae horas agrupadas por día (un row por reporte) */
export function useHorasPorDiaObra(obraId: string | null) {
  return useQuery({
    queryKey: ["obra_horas_por_dia", obraId],
    enabled: !!obraId,
    queryFn: async (): Promise<HorasPorDia[]> => {
      if (!obraId) return [];
      const { data, error } = await supabase.rpc("get_horas_por_dia_obra", {
        p_obra_id: obraId,
      });
      if (error) {
        console.warn("Error horas por día:", error.message);
        return [];
      }
      return (data ?? []).map((d: any) => ({
        reporte_id: d.reporte_id,
        reporte_codigo: d.reporte_codigo,
        fecha: d.fecha,
        hora_entrada: d.hora_entrada,
        hora_salida: d.hora_salida,
        horas_dia: Number(d.horas_dia) || 0,
        cantidad_asistentes: Number(d.cantidad_asistentes) || 0,
        asistentes: d.asistentes ?? [],
        costo_dia: Number(d.costo_dia) || 0,
      }));
    },
  });
}
