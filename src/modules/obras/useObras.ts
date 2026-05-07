import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Obra, ObraConRelaciones } from "@/types/database";

const KEY = "obras";

// Lista todas las obras con sus relaciones
export function useObras() {
  return useQuery({
    queryKey: [KEY],
    queryFn: async (): Promise<ObraConRelaciones[]> => {
      const { data, error } = await supabase
        .from("obras")
        .select(`
          *,
          cliente:clientes(*),
          jefe_obra:usuarios!obras_jefe_obra_id_fkey(*)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as ObraConRelaciones[];
    },
  });
}

// Obtener una obra individual con técnicos
export function useObra(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, id],
    enabled: !!id,
    queryFn: async (): Promise<ObraConRelaciones | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("obras")
        .select(`
          *,
          cliente:clientes(*),
          jefe_obra:usuarios!obras_jefe_obra_id_fkey(*),
          obra_tecnicos(usuario:usuarios!obra_tecnicos_tecnico_id_fkey(*))
        `)
        .eq("id", id)
        .single();
      if (error) throw error;
      const obra = data as any;
      obra.tecnicos = (obra.obra_tecnicos ?? []).map((ot: any) => ot.usuario);
      delete obra.obra_tecnicos;
      return obra as ObraConRelaciones;
    },
  });
}

// Crear obra
type CrearObraInput = {
  cliente_id: string | null;
  nombre_obra: string;
  sitio?: string | null;
  alcance_tecnico?: string | null;
  fecha_inicio_est?: string | null;
  fecha_fin_est?: string | null;
  presupuesto?: number;
  jefe_obra_id?: string | null;
  observaciones?: string | null;
  tecnicos_ids?: string[]; // adicionales
};

async function generarObraId(prefijoCliente: string): Promise<string> {
  // Cuenta cuántas obras hay con ese prefijo y genera el siguiente
  const prefix = prefijoCliente.toUpperCase().substring(0, 2);
  const { data, error } = await supabase
    .from("obras")
    .select("obra_id")
    .like("obra_id", `OT-${prefix}-%`);
  if (error) throw error;
  const max = (data ?? [])
    .map(r => parseInt(r.obra_id.split("-").pop() || "0"))
    .reduce((m, n) => Math.max(m, n), 0);
  return `OT-${prefix}-${String(max + 1).padStart(4, "0")}`;
}

export function useCrearObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CrearObraInput) => {
      // Determinar prefijo desde el cliente
      let prefix = "XX";
      if (input.cliente_id) {
        const { data: cli } = await supabase
          .from("clientes").select("nombre").eq("id", input.cliente_id).single();
        if (cli?.nombre) {
          prefix = cli.nombre.replace(/[^A-Za-z]/g, "").substring(0, 2).toUpperCase() || "XX";
        }
      }
      const obraId = await generarObraId(prefix);
      const userResp = await supabase.auth.getUser();
      const userId = userResp.data.user?.id;

      const { data: obra, error } = await supabase
        .from("obras")
        .insert({
          obra_id: obraId,
          cliente_id: input.cliente_id,
          nombre_obra: input.nombre_obra,
          sitio: input.sitio ?? null,
          alcance_tecnico: input.alcance_tecnico ?? null,
          fecha_inicio_est: input.fecha_inicio_est ?? null,
          fecha_fin_est: input.fecha_fin_est ?? null,
          presupuesto: input.presupuesto ?? 0,
          estado: "Pendiente OIO" as const,
          jefe_obra_id: input.jefe_obra_id ?? null,
          observaciones: input.observaciones ?? null,
          created_by: userId ?? null,
        } as any)
        .select()
        .single();
      if (error) throw error;

      // Insertar técnicos adicionales
      if (input.tecnicos_ids && input.tecnicos_ids.length > 0) {
        const rows = input.tecnicos_ids.map(tid => ({
          obra_id: obra.id,
          tecnico_id: tid,
        }));
        await supabase.from("obra_tecnicos").insert(rows);
      }

      return obra;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

// Editar obra
export function useEditarObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id, patch, tecnicos_ids,
    }: { id: string; patch: Partial<Obra>; tecnicos_ids?: string[] }) => {
      const { data, error } = await supabase
        .from("obras")
        .update(patch as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;

      if (tecnicos_ids !== undefined) {
        // Reemplazar técnicos asignados
        await supabase.from("obra_tecnicos").delete().eq("obra_id", id);
        if (tecnicos_ids.length > 0) {
          const rows = tecnicos_ids.map(tid => ({ obra_id: id, tecnico_id: tid }));
          await supabase.from("obra_tecnicos").insert(rows);
        }
      }

      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: [KEY, vars.id] });
    },
  });
}

// Eliminar obra
export function useEliminarObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("obras").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

// Cambiar estado
export function useCambiarEstadoObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: Obra["estado"] }) => {
      const { error } = await supabase.from("obras").update({ estado } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
