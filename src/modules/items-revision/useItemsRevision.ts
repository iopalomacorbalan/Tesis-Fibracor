import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface ItemEnRevision {
  movimiento_id: string;
  item_id: string;
  item_codigo: string;
  descripcion: string;
  categoria: string;
  unidad: string;
  numero_serie: string | null;
  ubicacion_fisica: string | null;
  cantidad: number;
  fecha_devolucion: string;
  estado_destino: string;
  tipo_movimiento: string;
  tecnico_id: string | null;
  tecnico_nombre: string | null;
  obra_id: string | null;
  obra_codigo: string | null;
  observaciones: string | null;
}

const KEY = "items_en_revision";

export function useItemsEnRevision() {
  return useQuery({
    queryKey: [KEY],
    queryFn: async (): Promise<ItemEnRevision[]> => {
      const { data, error } = await supabase.rpc("get_items_en_revision");
      if (error) {
        console.warn("Error items revisión:", error.message);
        return [];
      }
      return (data ?? []).map((r: any) => ({
        movimiento_id: r.movimiento_id,
        item_id: r.item_id,
        item_codigo: r.item_codigo,
        descripcion: r.descripcion,
        categoria: r.categoria,
        unidad: r.unidad,
        numero_serie: r.numero_serie,
        ubicacion_fisica: r.ubicacion_fisica,
        cantidad: Number(r.cantidad) || 0,
        fecha_devolucion: r.fecha_devolucion,
        estado_destino: r.estado_destino,
        tipo_movimiento: r.tipo_movimiento,
        tecnico_id: r.tecnico_id,
        tecnico_nombre: r.tecnico_nombre,
        obra_id: r.obra_id,
        obra_codigo: r.obra_codigo,
        observaciones: r.observaciones,
      }));
    },
  });
}

export function useReactivarItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { movimiento_id: string; observaciones?: string }) => {
      const { error } = await supabase.rpc("reactivar_desde_revision", {
        p_movimiento_id: args.movimiento_id,
        p_observaciones: args.observaciones ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ["inventario"] });
    },
  });
}

export function useDarBajaItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { movimiento_id: string; observaciones?: string }) => {
      const { error } = await supabase.rpc("dar_baja_desde_revision", {
        p_movimiento_id: args.movimiento_id,
        p_observaciones: args.observaciones ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ["inventario"] });
    },
  });
}
