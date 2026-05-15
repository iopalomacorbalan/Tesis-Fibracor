import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

const KEY = "asignaciones_personales";

export interface HerramientaPersonal {
  item_id: string;
  item_codigo: string;
  descripcion: string;
  categoria: string;
  unidad: string;
  numero_serie: string | null;
  ubicacion_fisica: string | null;
  cantidad_asignada: number;
  cantidad_devuelta: number;
  cantidad_pendiente: number;
  cantidad_en_poder: number;
  ultima_asignacion: string | null;
}

/** Lista de items que un técnico tiene asignados personalmente */
export function useHerramientasPersonales(tecnicoId: string | null) {
  return useQuery({
    queryKey: [KEY, tecnicoId],
    enabled: !!tecnicoId,
    queryFn: async (): Promise<HerramientaPersonal[]> => {
      if (!tecnicoId) return [];
      const { data, error } = await supabase.rpc("get_herramientas_personales", {
        p_tecnico_id: tecnicoId,
      });
      if (error) {
        console.warn("Error herramientas personales:", error.message);
        return [];
      }
      return (data ?? []).map((h: any) => ({
        item_id: h.item_id,
        item_codigo: h.item_codigo,
        descripcion: h.descripcion,
        categoria: h.categoria,
        unidad: h.unidad,
        numero_serie: h.numero_serie,
        ubicacion_fisica: h.ubicacion_fisica,
        cantidad_asignada: Number(h.cantidad_asignada) || 0,
        cantidad_devuelta: Number(h.cantidad_devuelta) || 0,
        cantidad_pendiente: Number(h.cantidad_pendiente) || 0,
        cantidad_en_poder: Number(h.cantidad_en_poder) || 0,
        ultima_asignacion: h.ultima_asignacion,
      }));
    },
  });
}

/** Lista de movimientos personales (asignaciones + devoluciones pendientes/efectivas) por técnico */
export function useMovimientosPersonales(tecnicoId: string | null) {
  return useQuery({
    queryKey: [KEY, "movs", tecnicoId],
    enabled: !!tecnicoId,
    queryFn: async () => {
      if (!tecnicoId) return [];
      const { data, error } = await supabase
        .from("movimientos")
        .select(`
          id, tipo, cantidad, fecha, observaciones, created_at,
          item:inventario(id, item_id, descripcion, unidad, numero_serie, ubicacion_fisica)
        `)
        .eq("tecnico_id", tecnicoId)
        .in("tipo", ["Asignacion_personal", "Devolucion_personal", "Devolucion_personal_pendiente"])
        .order("fecha", { ascending: false })
        .limit(100);
      if (error) {
        console.warn("Error movs personales:", error.message);
        return [];
      }
      return data ?? [];
    },
  });
}

/** Crear asignación personal (pañol entrega items a técnico) */
export function useAsignarPersonal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      tecnico_id: string;
      items: Array<{ item_id: string; cantidad: number }>;
      observaciones?: string;
    }) => {
      const fecha = new Date().toISOString();

      const rows = args.items.map(it => ({
        tipo: "Asignacion_personal",
        item_id: it.item_id,
        cantidad: it.cantidad,
        tecnico_id: args.tecnico_id,
        obra_id: null,
        fecha,
        observaciones: args.observaciones ?? null,
      }));

      const { error } = await supabase.from("movimientos").insert(rows as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ["inventario"] });
    },
  });
}

/** Solicitar devolución (técnico o pañol) - marca como pendiente */
export function useSolicitarDevolucionPersonal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      tecnico_id: string;
      item_id: string;
      cantidad: number;
      motivo?: string;
    }) => {
      // Verificar si ya existe una pendiente para este técnico+item
      const { data: existente } = await supabase
        .from("movimientos")
        .select("id, cantidad")
        .eq("tipo", "Devolucion_personal_pendiente")
        .eq("tecnico_id", args.tecnico_id)
        .eq("item_id", args.item_id)
        .limit(1)
        .maybeSingle();

      if (existente) {
        throw new Error(`Ya existe una solicitud de devolución pendiente para este item (${existente.cantidad} unidades). Esperá a que pañol la procese.`);
      }

      const { error } = await supabase.from("movimientos").insert({
        tipo: "Devolucion_personal_pendiente",
        item_id: args.item_id,
        cantidad: args.cantidad,
        tecnico_id: args.tecnico_id,
        obra_id: null,
        fecha: new Date().toISOString(),
        observaciones: args.motivo ?? null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ["devoluciones_personales_pendientes"] });
    },
  });
}

/** Aceptar devolución (pañol confirma recepción) - efectiva, regresa al stock */
export function useAceptarDevolucionPersonal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      tecnico_id: string;
      item_id: string;
      cantidad: number;
      observaciones?: string;
      estado_destino?: "disponible" | "revision" | "baja";
    }) => {
      // 1. Borrar TODAS las pendientes de este técnico+item
      await supabase
        .from("movimientos")
        .delete()
        .eq("tecnico_id", args.tecnico_id)
        .eq("item_id", args.item_id)
        .eq("tipo", "Devolucion_personal_pendiente");

      // 2. Insertar devolución efectiva con destino
      const { error: errDev } = await supabase.from("movimientos").insert({
        tipo: "Devolucion_personal",
        item_id: args.item_id,
        cantidad: args.cantidad,
        tecnico_id: args.tecnico_id,
        obra_id: null,
        fecha: new Date().toISOString(),
        observaciones: args.observaciones ?? null,
        estado_destino: args.estado_destino ?? "disponible",
      } as any);
      if (errDev) throw errDev;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ["inventario"] });
      qc.invalidateQueries({ queryKey: ["devoluciones_personales_pendientes"] });
      qc.invalidateQueries({ queryKey: ["items_en_revision"] });
    },
  });
}
