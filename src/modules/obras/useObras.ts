import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Obra, ObraConRelaciones } from "@/types/database";

const KEY = "obras";

export function useObras() {
  return useQuery({
    queryKey: [KEY],
    queryFn: async (): Promise<ObraConRelaciones[]> => {
      const { data, error } = await supabase
        .from("obras")
        .select(`
          *,
          cliente:clientes(*),
          jefe_obra:usuarios!obras_jefe_obra_id_fkey(*),
          obra_tecnicos(usuario:usuarios!obra_tecnicos_tecnico_id_fkey(*))
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Aplanar obra_tecnicos -> tecnicos (igual que en useObra)
      const obrasConTecnicos = ((data ?? []) as any[]).map(obra => {
        obra.tecnicos = (obra.obra_tecnicos ?? []).map((ot: any) => ot.usuario);
        delete obra.obra_tecnicos;
        return obra;
      });

      return obrasConTecnicos as unknown as ObraConRelaciones[];
    },
  });
}

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
      if (error) {
        console.error("Error cargando obra:", error);
        throw error;
      }
      const obra = data as any;
      obra.tecnicos = (obra.obra_tecnicos ?? []).map((ot: any) => ot.usuario);
      delete obra.obra_tecnicos;
      return obra as ObraConRelaciones;
    },
    retry: false, // No reintentar errores RLS
  });
}

type CrearObraInput = {
  cliente_id: string | null;
  nombre_obra: string;
  sitio?: string | null;
  alcance_tecnico?: string | null;
  maps_url?: string | null;
  fecha_inicio_est?: string | null;
  fecha_fin_est?: string | null;
  presupuesto?: number;
  jefe_obra_id?: string | null;
  observaciones?: string | null;
  tecnicos_ids?: string[];
};

async function generarObraId(prefijoCliente: string): Promise<string> {
  const prefix = prefijoCliente.toUpperCase().substring(0, 2);
  const { data, error } = await supabase
    .from("obras")
    .select("obra_id")
    .like("obra_id", `OT-${prefix}-%`);
  if (error) throw error;
  const max = ((data as any[]) ?? [])
    .map((r: any) => parseInt(String(r.obra_id ?? "").split("-").pop() || "0"))
    .reduce((m: number, n: number) => Math.max(m, n), 0);
  return `OT-${prefix}-${String(max + 1).padStart(4, "0")}`;
}

export function useCrearObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CrearObraInput) => {
      let prefix = "XX";
      if (input.cliente_id) {
        const { data: cli } = await supabase
          .from("clientes").select("nombre").eq("id", input.cliente_id).single();
        const cliRow = cli as any;
        if (cliRow?.nombre) {
          prefix = String(cliRow.nombre).replace(/[^A-Za-z]/g, "").substring(0, 2).toUpperCase() || "XX";
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
          maps_url: input.maps_url ?? null,
          fecha_inicio_est: input.fecha_inicio_est ?? null,
          fecha_fin_est: input.fecha_fin_est ?? null,
          presupuesto: input.presupuesto ?? 0,
          estado: "Pendiente OIO",
          jefe_obra_id: input.jefe_obra_id ?? null,
          observaciones: input.observaciones ?? null,
          created_by: userId ?? null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      const obraRow = obra as any;

      if (input.tecnicos_ids && input.tecnicos_ids.length > 0) {
        const rows = input.tecnicos_ids.map(tid => ({
          obra_id: obraRow.id,
          tecnico_id: tid,
        }));
        await supabase.from("obra_tecnicos").insert(rows as any);
      }

      return obraRow as Obra;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

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
        await supabase.from("obra_tecnicos").delete().eq("obra_id", id);
        if (tecnicos_ids.length > 0) {
          const rows = tecnicos_ids.map(tid => ({ obra_id: id, tecnico_id: tid }));
          await supabase.from("obra_tecnicos").insert(rows as any);
        }
      }

      return data as Obra;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: [KEY, vars.id] });
    },
  });
}

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

// Cierre completo: genera devoluciones automáticas y cancela solicitudes pendientes
export function useCerrarObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, observaciones }: { id: string; observaciones?: string }) => {
      const { data, error } = await supabase.rpc("cerrar_obra_con_devoluciones", {
        p_obra_id: id,
        p_observaciones: observaciones ?? "",
      });
      if (error) throw error;
      return data as { status: string; herramientas_generadas: number; materiales_pendientes: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ["movimientos"] });
      qc.invalidateQueries({ queryKey: ["solicitudes"] });
      qc.invalidateQueries({ queryKey: ["inventario"] });
    },
  });
}

// Marcar como Cerrada (después de "Para cierre", cuando todas las devoluciones se procesaron)
export function useFinalizarObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("obras")
        .update({
          estado: "Cerrada",
          fecha_fin_real: new Date().toISOString().slice(0, 10),
          closed_at: new Date().toISOString(),
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export interface ObraHistorialItem {
  id: string;
  tipo: "creada" | "estado";
  estado_anterior: string | null;
  estado_nuevo: string | null;
  comentario: string | null;
  created_at: string;
  usuario: { nombre: string } | null;
}

// Historial de creación y cambios de estado (lo llena un trigger, ver sql/064)
export function useObraHistorial(obraId: string | undefined) {
  return useQuery({
    queryKey: [KEY, obraId, "historial"],
    enabled: !!obraId,
    queryFn: async (): Promise<ObraHistorialItem[]> => {
      const { data, error } = await supabase
        .from("historial_cambios_obras")
        .select("id, tipo, estado_anterior, estado_nuevo, comentario, created_at, usuario:usuarios(nombre)")
        .eq("obra_id", obraId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ObraHistorialItem[];
    },
    retry: false,
  });
}

// Agrega el comentario/motivo al último cambio de estado que hizo el usuario
export async function comentarCambioEstado(obraId: string, comentario: string) {
  if (!comentario.trim()) return;
  const { error } = await supabase.rpc("comentar_cambio_estado_obra", {
    p_obra_id: obraId,
    p_comentario: comentario,
  } as any);
  if (error) throw error;
}

// Reabrir una obra cerrada (solo Dirección) → vuelve a "En ejecucion"
// para poder editarla o cargar gastos. Limpia el cierre.
export function useReabrirObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("obras")
        .update({
          estado: "En ejecucion",
          closed_at: null,
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
