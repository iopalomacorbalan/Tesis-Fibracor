import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface RegistroAuditoria {
  id: number;
  tabla: string;
  registro_id: string | null;
  referencia: string | null;
  accion: "INSERT" | "UPDATE" | "DELETE";
  usuario_id: string | null;
  usuario_nombre: string | null;
  cambios: Record<string, any> | null;
  created_at: string;
}

const LIMITE = 300;

export function useAuditoria(filtros: { tabla: string; accion: string }) {
  return useQuery({
    queryKey: ["auditoria", filtros],
    queryFn: async (): Promise<RegistroAuditoria[]> => {
      let q = supabase.from("auditoria").select("*").order("created_at", { ascending: false }).limit(LIMITE);
      if (filtros.tabla !== "todas") q = q.eq("tabla", filtros.tabla);
      if (filtros.accion !== "todas") q = q.eq("accion", filtros.accion);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as RegistroAuditoria[];
    },
  });
}
