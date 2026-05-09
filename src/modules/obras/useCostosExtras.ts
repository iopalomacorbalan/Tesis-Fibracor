import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface CostoExtra {
  id: string;
  obra_id: string;
  concepto: string;
  monto: number;
  observaciones: string | null;
  created_at: string;
  created_by: string | null;
}

const KEY = "costos_extras";

export function useCostosExtras(obraId: string | null) {
  return useQuery({
    queryKey: [KEY, obraId],
    enabled: !!obraId,
    queryFn: async (): Promise<CostoExtra[]> => {
      if (!obraId) return [];
      const { data, error } = await supabase
        .from("costos_extras_obra")
        .select("*")
        .eq("obra_id", obraId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CostoExtra[];
    },
  });
}

export function useAgregarCostoExtra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      obra_id: string;
      concepto: string;
      monto: number;
      observaciones?: string | null;
    }) => {
      const userResp = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("costos_extras_obra")
        .insert({
          obra_id: input.obra_id,
          concepto: input.concepto,
          monto: input.monto,
          observaciones: input.observaciones ?? null,
          created_by: userResp.data.user?.id ?? null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as CostoExtra;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: [KEY, vars.obra_id] });
      qc.invalidateQueries({ queryKey: ["obra_costos"] });
    },
  });
}

export function useEliminarCostoExtra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("costos_extras_obra").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ["obra_costos"] });
    },
  });
}
