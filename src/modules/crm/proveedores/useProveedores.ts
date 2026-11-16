import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Proveedor } from "@/types/database";

const KEY = "proveedores";

export function useProveedores(includeInactivos = false) {
  return useQuery({
    queryKey: [KEY, { includeInactivos }],
    queryFn: async (): Promise<Proveedor[]> => {
      let q = supabase.from("proveedores").select("*, proveedor_rubros(rubro:rubros(nombre))");
      if (!includeInactivos) q = q.eq("activo", true);
      const { data, error } = await q.order("nombre");
      if (error) throw error;
      // Los rubros salen de las tablas rubros / proveedor_rubros, no de la columna vieja
      return (data ?? []).map(({ proveedor_rubros, ...p }: any) => ({
        ...p,
        rubros: (proveedor_rubros ?? []).map((pr: any) => pr.rubro?.nombre).filter(Boolean).sort(),
      })) as Proveedor[];
    },
  });
}

/** Catálogo de rubros (para las sugerencias del formulario). */
export function useRubros() {
  return useQuery({
    queryKey: ["rubros"],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.from("rubros").select("nombre").order("nombre");
      if (error) throw error;
      return (data ?? []).map(r => r.nombre);
    },
  });
}

async function guardarRubros(proveedorId: string, rubros: string[] | null | undefined) {
  const { error } = await supabase.rpc("set_rubros_proveedor", {
    p_proveedor_id: proveedorId,
    p_rubros: rubros ?? [],
  });
  if (error) throw error;
}

type ProveedorInput = {
  nombre: string;
  cuit?: string | null;
  contacto?: string | null;
  email?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  rubros?: string[] | null;
  notas?: string | null;
};

async function generarProveedorId(): Promise<string> {
  const { data } = await supabase.from("proveedores").select("proveedor_id");
  const max = (data ?? [])
    .map(p => parseInt(p.proveedor_id.replace("PRV-", "") || "0"))
    .reduce((m, n) => Math.max(m, n), 0);
  return `PRV-${String(max + 1).padStart(3, "0")}`;
}

export function useCrearProveedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProveedorInput) => {
      const proveedor_id = await generarProveedorId();
      const { data, error } = await supabase
        .from("proveedores")
        .insert({
          proveedor_id,
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
      await guardarRubros(data.id, input.rubros);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ["rubros"] });
    },
  });
}

export function useEditarProveedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Proveedor> }) => {
      const { rubros, ...resto } = patch;
      if (Object.keys(resto).length > 0) {
        const { error } = await supabase.from("proveedores").update(resto as any).eq("id", id);
        if (error) throw error;
      }
      if (rubros !== undefined) await guardarRubros(id, rubros);
      const { data, error } = await supabase.from("proveedores").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ["rubros"] });
    },
  });
}

export function useEliminarProveedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete
      const { error } = await supabase
        .from("proveedores")
        .update({ activo: false } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
