import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

const KEY = "config_global";

interface PrecioHoraConfig {
  amount: number;
  currency: string;
}

/** Hook para obtener el precio actual de hora técnica */
export function usePrecioHoraTecnica() {
  return useQuery({
    queryKey: [KEY, "precio_hora_tecnica"],
    queryFn: async (): Promise<PrecioHoraConfig> => {
      const { data, error } = await supabase
        .from("configuracion_global")
        .select("valor")
        .eq("clave", "precio_hora_tecnica")
        .maybeSingle();
      if (error) {
        console.warn("No se pudo leer precio hora:", error.message);
        return { amount: 0, currency: "ARS" };
      }
      return (data?.valor as PrecioHoraConfig) ?? { amount: 0, currency: "ARS" };
    },
  });
}

/** Hook para actualizar el precio (solo Dirección por RLS) */
export function useActualizarPrecioHora() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nuevoPrecio: number) => {
      const userResp = await supabase.auth.getUser();
      const userId = userResp.data.user?.id;
      const { error } = await supabase
        .from("configuracion_global")
        .update({
          valor: { amount: nuevoPrecio, currency: "ARS" },
          updated_at: new Date().toISOString(),
          updated_by: userId ?? null,
        })
        .eq("clave", "precio_hora_tecnica");
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ["obra_horas_tecnicas"] });
    },
  });
}
