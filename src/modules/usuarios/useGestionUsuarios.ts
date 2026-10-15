import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Usuario, UserArea } from "@/types/database";

const KEY = "usuarios-gestion";

/** Todos los usuarios, incluidos los inactivos (para la pantalla de gestión). */
export function useTodosUsuarios() {
  return useQuery({
    queryKey: [KEY],
    queryFn: async (): Promise<Usuario[]> => {
      const { data, error } = await supabase.from("usuarios").select("*").order("nombre");
      if (error) throw error;
      return (data ?? []) as Usuario[];
    },
  });
}

// Las altas pasan por la Edge Function porque crear usuarios de Auth requiere la service role
async function llamar(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("gestionar-usuarios", { body });
  if (error) {
    // Rescatar el mensaje que devuelve la función (viene en el body de la respuesta)
    let msg = error.message;
    try {
      const j = await (error as any).context?.json();
      if (j?.error) msg = j.error;
    } catch { /* respuesta sin JSON */ }
    if (/Failed to send|not found|404/i.test(msg)) {
      msg = "La función 'gestionar-usuarios' no está desplegada en Supabase";
    }
    throw new Error(msg);
  }
  return data;
}

function useInvalidar() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: [KEY] });
    qc.invalidateQueries({ queryKey: ["usuarios"] });
    qc.invalidateQueries({ queryKey: ["obras"] });
  };
}

export type CrearUsuarioInput = {
  nombre: string;
  email: string;
  password: string;
  area: UserArea;
  telefono?: string;
};

export function useCrearUsuario() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (input: CrearUsuarioInput) => llamar({ accion: "crear", ...input }) as Promise<Usuario>,
    onSuccess: invalidar,
  });
}

export type EditarUsuarioInput = {
  id: string;
  nombre?: string;
  area?: UserArea;
  telefono?: string;
  activo?: boolean;
};

export function useEditarUsuario() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (input: EditarUsuarioInput) => llamar({ accion: "editar", ...input }) as Promise<Usuario>,
    onSuccess: invalidar,
  });
}

export function useCambiarPassword() {
  return useMutation({
    mutationFn: (input: { id: string; password: string }) =>
      llamar({ accion: "cambiar_password", ...input }),
  });
}
