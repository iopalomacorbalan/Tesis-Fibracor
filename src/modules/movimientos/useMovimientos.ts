import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { MovimientoConRelaciones } from "@/types/database";

const KEY = "movimientos";

export function useMovimientos(limit = 200) {
  return useQuery({
    queryKey: [KEY, { limit }],
    queryFn: async (): Promise<MovimientoConRelaciones[]> => {
      const { data, error } = await supabase
        .from("movimientos")
        .select(`
          *,
          item:inventario(id, item_id, descripcion, categoria, unidad),
          obra:obras(id, obra_id, nombre_obra),
          tecnico:usuarios!movimientos_tecnico_id_fkey(id, nombre, area),
          ejecutor:usuarios!movimientos_ejecutado_por_fkey(id, nombre)
        `)
        .order("fecha", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return ((data ?? []) as any[]) as MovimientoConRelaciones[];
    },
  });
}

export function useDevolucionesPendientes() {
  return useQuery({
    queryKey: [KEY, "devoluciones_pendientes"],
    queryFn: async (): Promise<MovimientoConRelaciones[]> => {
      const { data, error } = await supabase
        .from("movimientos")
        .select(`
          *,
          item:inventario(id, item_id, descripcion, categoria, unidad),
          obra:obras(id, obra_id, nombre_obra),
          tecnico:usuarios!movimientos_tecnico_id_fkey(id, nombre, area)
        `)
        .eq("tipo", "Devolucion_pendiente")
        .order("fecha", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]) as MovimientoConRelaciones[];
    },
  });
}

// Aceptar devolución (RPC)
type AceptarInput = {
  mov_pendiente_id: string;
  estado_recibido: string; // "Bueno", "Dañada", "Necesita mantenimiento", "Cancelado"
  observaciones?: string;
};

export function useAceptarDevolucion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AceptarInput) => {
      const { data, error } = await supabase.rpc("aceptar_devolucion", {
        p_mov_pendiente_id: input.mov_pendiente_id,
        p_estado_recibido: input.estado_recibido,
        p_observaciones: input.observaciones ?? "",
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ["inventario"] });
    },
  });
}

// Rechazar / cancelar devolución pendiente
export function useCancelarDevolucionPendiente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (movId: string) => {
      const { error } = await supabase.from("movimientos").delete().eq("id", movId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
    },
  });
}

// Solicitar devolución (técnico)
type SolicitarDevolucionInput = {
  item_id: string;
  cantidad: number;
  obra_id: string | null;
  estado_herramienta: string;
  observaciones?: string;
};

export function useSolicitarDevolucion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SolicitarDevolucionInput) => {
      // Chequear que no exista pendiente ya
      // (necesitamos el tecnico_id que tiene el item — lo buscamos por el item+obra activos)
      let query = supabase
        .from("movimientos")
        .select("id, cantidad, tecnico_id")
        .eq("tipo", "Devolucion_pendiente")
        .eq("item_id", input.item_id);
      if (input.obra_id) query = query.eq("obra_id", input.obra_id);
      const { data: existentes } = await query.limit(1);

      if (existentes && existentes.length > 0) {
        throw new Error(
          `Ya existe una solicitud de devolución pendiente para este item${input.obra_id ? " en esta obra" : ""}. Esperá a que pañol la procese.`
        );
      }

      const { data, error } = await supabase.rpc("solicitar_devolucion", {
        p_item_id: input.item_id,
        p_cantidad: input.cantidad,
        p_obra_id: input.obra_id,
        p_estado_herramienta: input.estado_herramienta,
        p_observaciones: input.observaciones ?? "",
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: [KEY, "devoluciones_pendientes"] });
    },
  });
}

// Herramientas asignadas a un técnico (RPC)
export function useHerramientasAsignadas(tecnicoId?: string | null) {
  return useQuery({
    queryKey: [KEY, "asignadas", tecnicoId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_herramientas_asignadas", {
        p_tecnico_id: tecnicoId ?? null,
      });
      if (error) throw error;
      return data ?? [];
    },
  });
}
