import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface ItemPendienteOc {
  solicitud_item_id: string;
  solicitud_id: string;
  solicitud_codigo: string;
  fecha_solicitud: string;
  prioridad: string;
  obra_id: string | null;
  obra_codigo: string | null;
  obra_nombre: string | null;
  tecnico_id: string | null;
  tecnico_nombre: string | null;
  item_id: string | null;
  item_codigo: string | null;
  item_descripcion: string | null;
  descripcion_libre: string | null;
  cantidad: number;
  unidad: string;
  stock_actual: number;
  observaciones: string | null;
}

export function useItemsPendientesOc() {
  return useQuery({
    queryKey: ["items_pendientes_oc"],
    queryFn: async (): Promise<ItemPendienteOc[]> => {
      const { data, error } = await supabase.rpc("get_items_pendientes_oc");
      if (error) throw error;
      return (data ?? []) as ItemPendienteOc[];
    },
  });
}

// Hook para crear una OC a partir de items pendientes
export interface CrearOcDesdePendientesInput {
  proveedor_id: string;
  obra_id?: string | null;
  moneda?: "ARS" | "USD";
  observaciones?: string | null;
  items: Array<{
    solicitud_item_id: string;
    item_id: string | null;
    descripcion: string;
    cantidad: number;
    precio_unitario: number;
  }>;
}

export function useCrearOcDesdePendientes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CrearOcDesdePendientesInput) => {
      const userResp = await supabase.auth.getUser();
      const userId = userResp.data.user?.id;

      const total = input.items.reduce(
        (sum, it) => sum + (it.cantidad * it.precio_unitario), 0
      );

      // 1) Crear la compra (compra_id por trigger)
      const { data: compra, error } = await supabase
        .from("compras")
        .insert({
          proveedor_id: input.proveedor_id,
          obra_id: input.obra_id ?? null,
          fecha_solicitud: new Date().toISOString().slice(0, 10),
          estado: "Solicitada",
          total_estimado: total,
          moneda: input.moneda ?? "ARS",
          observaciones: input.observaciones ?? "Generada desde pendientes de OC",
          solicitado_por: userId ?? null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      const compraRow = compra as any;

      // 2) Crear los items vinculados
      const rows = input.items.map(it => ({
        compra_id: compraRow.id,
        item_id: it.item_id,
        solicitud_item_id: it.solicitud_item_id,
        descripcion: it.descripcion,
        cantidad_solicitada: it.cantidad,
        cantidad_recibida: 0,
        precio_unitario: it.precio_unitario,
      }));
      const { error: errItems } = await supabase.from("compra_items").insert(rows as any);
      if (errItems) throw errItems;

      return compraRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items_pendientes_oc"] });
      qc.invalidateQueries({ queryKey: ["compras"] });
      qc.invalidateQueries({ queryKey: ["solicitudes"] });
    },
  });
}
