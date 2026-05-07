import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Cliente } from "@/types/database";

const KEY = "clientes";

export function useClientes(includeInactivos = false) {
  return useQuery({
    queryKey: [KEY, { includeInactivos }],
    queryFn: async (): Promise<Cliente[]> => {
      let q = supabase
        .from("clientes")
        .select("*")
        .is("deleted_at", null);
      if (!includeInactivos) q = q.eq("activo", true);
      const { data, error } = await q.order("nombre");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCliente(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, id],
    enabled: !!id,
    queryFn: async (): Promise<Cliente | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("clientes").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });
}

type ClienteInput = {
  nombre: string;
  cuit?: string | null;
  contacto?: string | null;
  email?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  notas?: string | null;
};

async function generarClienteId(): Promise<string> {
  const { data } = await supabase
    .from("clientes")
    .select("cliente_id");
  const max = (data ?? [])
    .map(c => parseInt(c.cliente_id.replace("CLI-", "") || "0"))
    .reduce((m, n) => Math.max(m, n), 0);
  return `CLI-${String(max + 1).padStart(3, "0")}`;
}

export function useCrearCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ClienteInput) => {
      const cliente_id = await generarClienteId();
      const { data, error } = await supabase
        .from("clientes")
        .insert({
          cliente_id,
          nombre: input.nombre,
          cuit: input.cuit ?? null,
          contacto: input.contacto ?? null,
          email: input.email ?? null,
          telefono: input.telefono ?? null,
          direccion: input.direccion ?? null,
          notas: input.notas ?? null,
          activo: true,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useEditarCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Cliente> }) => {
      const { data, error } = await supabase
        .from("clientes")
        .update(patch as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useEliminarCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete
      const { error } = await supabase
        .from("clientes")
        .update({ deleted_at: new Date().toISOString(), activo: false } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
