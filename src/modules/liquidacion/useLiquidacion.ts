import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface DiaLiquidacion {
  tecnico_id: string;
  tecnico_nombre: string;
  fecha: string;
  horas_dia: number;
  horas_normales: number;
  horas_extras: number;
  obras: string | null;
  valor_hora: number;
  valor_hora_extra: number;
}

export interface TecnicoLiquidacion {
  tecnico_id: string;
  tecnico_nombre: string;
  dias: DiaLiquidacion[];
  total_horas: number;
  total_normales: number;
  total_extras: number;
  valor_hora: number;
  valor_hora_extra: number;
  monto_normales: number;
  monto_extras: number;
  monto_total: number;
}

const KEY = "liquidacion_horas";

export function useLiquidacionHoras(desde: string, hasta: string) {
  return useQuery({
    queryKey: [KEY, desde, hasta],
    enabled: !!desde && !!hasta,
    queryFn: async (): Promise<TecnicoLiquidacion[]> => {
      const { data, error } = await supabase.rpc("get_liquidacion_horas", {
        p_desde: desde,
        p_hasta: hasta,
      });
      if (error) {
        console.warn("Error liquidación:", error.message);
        return [];
      }

      const dias: DiaLiquidacion[] = (data ?? []).map((d: any) => ({
        tecnico_id: d.tecnico_id,
        tecnico_nombre: d.tecnico_nombre,
        fecha: d.fecha,
        horas_dia: Number(d.horas_dia) || 0,
        horas_normales: Number(d.horas_normales) || 0,
        horas_extras: Number(d.horas_extras) || 0,
        obras: d.obras,
        valor_hora: Number(d.valor_hora) || 0,
        valor_hora_extra: Number(d.valor_hora_extra) || 0,
      }));

      // Agrupar por técnico
      const porTecnico = new Map<string, TecnicoLiquidacion>();
      for (const d of dias) {
        const cur = porTecnico.get(d.tecnico_id) ?? {
          tecnico_id: d.tecnico_id,
          tecnico_nombre: d.tecnico_nombre,
          dias: [],
          total_horas: 0,
          total_normales: 0,
          total_extras: 0,
          valor_hora: d.valor_hora,
          valor_hora_extra: d.valor_hora_extra,
          monto_normales: 0,
          monto_extras: 0,
          monto_total: 0,
        };
        cur.dias.push(d);
        cur.total_horas += d.horas_dia;
        cur.total_normales += d.horas_normales;
        cur.total_extras += d.horas_extras;
        porTecnico.set(d.tecnico_id, cur);
      }

      const lista = Array.from(porTecnico.values());
      for (const t of lista) {
        t.monto_normales = t.total_normales * t.valor_hora;
        t.monto_extras = t.total_extras * t.valor_hora_extra;
        t.monto_total = t.monto_normales + t.monto_extras;
      }
      return lista.sort((a, b) => a.tecnico_nombre.localeCompare(b.tecnico_nombre));
    },
  });
}

/** Valores globales (configuracion_global key/value) */
export function useValoresGlobales() {
  return useQuery({
    queryKey: [KEY, "config"],
    queryFn: async (): Promise<{ valor_hora: number; valor_hora_extra: number }> => {
      const { data } = await supabase
        .from("configuracion_global")
        .select("clave, valor")
        .in("clave", ["valor_hora_liquidacion", "valor_hora_extra_liquidacion"]);
      const map = new Map((data ?? []).map((r: any) => {
        // valor es JSONB: puede venir como número o string
        let n = 0;
        if (typeof r.valor === "number") n = r.valor;
        else if (typeof r.valor === "string") n = Number(r.valor.replace(",", ".")) || 0;
        return [r.clave, n];
      }));
      return {
        valor_hora: map.get("valor_hora_liquidacion") ?? 0,
        valor_hora_extra: map.get("valor_hora_extra_liquidacion") ?? 0,
      };
    },
  });
}

export function useGuardarValoresGlobales() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { valor_hora: number; valor_hora_extra: number }) => {
      const updates = [
        { clave: "valor_hora_liquidacion", valor: v.valor_hora, descripcion: "Valor global hora normal liquidación (ARS)" },
        { clave: "valor_hora_extra_liquidacion", valor: v.valor_hora_extra, descripcion: "Valor global hora extra liquidación (ARS)" },
      ];
      const { error } = await supabase
        .from("configuracion_global")
        .upsert(updates, { onConflict: "clave" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
    },
  });
}

/** Técnicos con sus overrides de valores */
export function useTecnicosValores() {
  return useQuery({
    queryKey: [KEY, "tecnicos_valores"],
    queryFn: async () => {
      const { data } = await supabase
        .from("usuarios")
        .select("id, nombre, area, valor_hora, valor_hora_extra")
        .eq("activo", true)
        .eq("area", "Tecnico")
        .order("nombre");
      return (data ?? []) as { id: string; nombre: string; area: string; valor_hora: number | null; valor_hora_extra: number | null }[];
    },
  });
}

export function useGuardarValorTecnico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; valor_hora: number | null; valor_hora_extra: number | null }) => {
      const { error } = await supabase
        .from("usuarios")
        .update({ valor_hora: args.valor_hora, valor_hora_extra: args.valor_hora_extra } as any)
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
