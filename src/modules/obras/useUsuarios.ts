import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Usuario, UserArea } from "@/types/database";

export function useUsuarios(filtroArea?: UserArea[]) {
  return useQuery({
    queryKey: ["usuarios", filtroArea],
    queryFn: async (): Promise<Usuario[]> => {
      let q = supabase.from("usuarios").select("*").eq("activo", true);
      if (filtroArea && filtroArea.length > 0) {
        q = q.in("area", filtroArea);
      }
      const { data, error } = await q.order("nombre");
      if (error) throw error;
      return (data ?? []) as Usuario[];
    },
  });
}

export function useTecnicos() {
  return useUsuarios(["Tecnico"]);
}
