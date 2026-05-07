import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Cliente } from "@/types/database";

const KEY = "clientes";

export function useClientes() {
  return useQuery({
    queryKey: [KEY],
    queryFn: async (): Promise<Cliente[]> => {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .is("deleted_at", null)
        .order("nombre");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCrearCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { nombre: string; cuit?: string; contacto?: string; email?: string; telefono?: string; direccion?: string }) => {
      // Generar cliente_id
      const { data: existing } = await supabase
        .from("clientes")
        .select("cliente_id");
      const max = (existing ?? [])
        .map(c => parseInt(c.cliente_id.replace("CLI-", "") || "0"))
        .reduce((m, n) => Math.max(m, n), 0);
      const cliente_id = `CLI-${String(max + 1).padStart(3, "0")}`;

      const { data, error } = await supabase
        .from("clientes")
        .insert({ cliente_id, nombre: input.nombre, cuit: input.cuit ?? null, contacto: input.contacto ?? null, email: input.email ?? null, telefono: input.telefono ?? null, direccion: input.direccion ?? null, activo: true } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
