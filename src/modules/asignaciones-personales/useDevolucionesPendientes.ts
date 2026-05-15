import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface DevolucionPendiente {
  id: string; // id del movimiento pendiente
  fecha: string;
  cantidad: number;
  observaciones: string | null;
  item_id: string;
  item_codigo: string;
  descripcion: string;
  unidad: string;
  ubicacion_fisica: string | null;
  tecnico_id: string;
  tecnico_nombre: string;
}

/** Lista de devoluciones personales pendientes de todos los técnicos */
export function useDevolucionesPendientes() {
  return useQuery({
    queryKey: ["devoluciones_personales_pendientes"],
    queryFn: async (): Promise<DevolucionPendiente[]> => {
      const { data, error } = await supabase
        .from("movimientos")
        .select(`
          id, fecha, cantidad, observaciones, tecnico_id,
          item:inventario(id, item_id, descripcion, unidad, ubicacion_fisica),
          tecnico:usuarios!movimientos_tecnico_id_fkey(nombre)
        `)
        .eq("tipo", "Devolucion_personal_pendiente")
        .is("obra_id", null)
        .order("fecha", { ascending: false });

      if (error) {
        console.warn("Error pendientes:", error.message);
        return [];
      }

      return ((data ?? []) as any[]).map(m => ({
        id: m.id,
        fecha: m.fecha,
        cantidad: Number(m.cantidad) || 0,
        observaciones: m.observaciones,
        item_id: m.item?.id,
        item_codigo: m.item?.item_id ?? "",
        descripcion: m.item?.descripcion ?? "—",
        unidad: m.item?.unidad ?? "ud.",
        ubicacion_fisica: m.item?.ubicacion_fisica ?? null,
        tecnico_id: m.tecnico_id,
        tecnico_nombre: m.tecnico?.nombre ?? "—",
      }));
    },
  });
}
