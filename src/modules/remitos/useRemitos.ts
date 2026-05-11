import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Remito, RemitoConRelaciones } from "@/types/database";

const KEY = "remitos";

export interface ItemRemitable {
  movimiento_id: string;
  item_id: string;
  item_codigo: string;
  descripcion: string;
  unidad: string;
  categoria: string;
  cantidad: number;
  fecha: string;
  tecnico_nombre: string | null;
}

export function useRemitos(obraId?: string | null) {
  return useQuery({
    queryKey: [KEY, { obraId }],
    queryFn: async (): Promise<RemitoConRelaciones[]> => {
      let q = supabase
        .from("remitos")
        .select(`
          *,
          obra:obras(id, obra_id, nombre_obra, sitio, cliente_id, cliente:clientes(*)),
          cliente_directo:clientes!remitos_cliente_id_fkey(*),
          creador:usuarios!remitos_created_by_fkey(id, nombre),
          items:remito_items(
            *,
            item:inventario(id, item_id, descripcion, unidad, categoria)
          )
        `);
      if (obraId) q = q.eq("obra_id", obraId);
      const { data, error } = await q.order("fecha", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map(r => ({
        ...r,
        // Cliente: si hay obra → de la obra; si no → cliente directo
        cliente: r.obra?.cliente ?? r.cliente_directo ?? null,
      })) as RemitoConRelaciones[];
    },
  });
}

export function useRemito(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, id],
    enabled: !!id,
    queryFn: async (): Promise<RemitoConRelaciones | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("remitos")
        .select(`
          *,
          obra:obras(id, obra_id, nombre_obra, sitio, cliente_id, cliente:clientes(*)),
          cliente_directo:clientes!remitos_cliente_id_fkey(*),
          creador:usuarios!remitos_created_by_fkey(id, nombre),
          items:remito_items(
            *,
            item:inventario(id, item_id, descripcion, unidad, categoria)
          )
        `)
        .eq("id", id)
        .single();
      if (error) throw error;
      const r = data as any;
      return {
        ...r,
        cliente: r.obra?.cliente ?? r.cliente_directo ?? null,
      };
    },
  });
}

// Items que se pueden remitir desde una obra (retiros sin remitir)
export function useItemsRemitables(obraId: string | null) {
  return useQuery({
    queryKey: ["items_remitables", obraId],
    enabled: !!obraId,
    queryFn: async (): Promise<ItemRemitable[]> => {
      if (!obraId) return [];
      const { data, error } = await supabase.rpc("get_items_remitables_obra", {
        p_obra_id: obraId,
      });
      if (error) throw error;
      return (data ?? []) as ItemRemitable[];
    },
  });
}

async function generarRemitoId(): Promise<string> {
  const { data } = await supabase.from("remitos").select("remito_id");
  const max = ((data as any[]) ?? [])
    .map((r: any) => parseInt(String(r.remito_id ?? "").split("-").pop() || "0"))
    .reduce((m: number, n: number) => Math.max(m, n), 0);
  return `REM-${String(max + 1).padStart(3, "0")}`;
}

async function generarMovId(): Promise<string> {
  const { data } = await supabase.from("movimientos").select("mov_id");
  const max = ((data as any[]) ?? [])
    .map((m: any) => parseInt(String(m.mov_id ?? "").split("-").pop() || "0"))
    .reduce((m: number, n: number) => Math.max(m, n), 0);
  return `MOV-${String(max + 1).padStart(3, "0")}`;
}

type CrearRemitoInput = {
  // Modo: desde obra o entrega directa
  obra_id?: string | null;
  cliente_id?: string | null;
  fecha?: string;
  recibido_por?: string | null;
  dni_receptor?: string | null;
  fecha_recepcion?: string | null;
  observaciones?: string | null;
  // Si true, descuenta del stock generando movimientos Retiro
  descontar_stock?: boolean;
  items: Array<{
    item_id: string | null;            // null si es descripción manual
    descripcion_libre?: string | null; // requerido si item_id null
    unidad?: string | null;
    movimiento_id?: string | null;     // viene cuando se crea desde un retiro existente
    cantidad: number;
    observaciones?: string | null;
  }>;
};

export function useCrearRemito() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CrearRemitoInput) => {
      const userResp = await supabase.auth.getUser();
      const userId = userResp.data.user?.id;

      // 1) Crear el remito PRIMERO (trigger asigna remito_id automático)
      const { data: rem, error } = await supabase
        .from("remitos")
        .insert({
          obra_id: input.obra_id ?? null,
          cliente_id: input.cliente_id ?? null,
          fecha: input.fecha ?? new Date().toISOString().slice(0, 10),
          recibido_por: input.recibido_por ?? null,
          dni_receptor: input.dni_receptor ?? null,
          fecha_recepcion: input.fecha_recepcion ?? null,
          observaciones: input.observaciones ?? null,
          created_by: userId ?? null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      const remRow = rem as any;
      const remitoIdReal = remRow.remito_id; // ID asignado por el trigger

      // 2) Generar movimientos Retiro si corresponde (mov_id por trigger)
      const itemsParaInsertar: Array<{
        item_id: string | null;
        descripcion_libre: string | null;
        unidad: string | null;
        movimiento_id: string | null;
        cantidad: number;
        observaciones: string | null;
      }> = [];

      for (const it of input.items) {
        let movimientoIdFinal = it.movimiento_id ?? null;

        if (input.descontar_stock && it.item_id && !it.movimiento_id) {
          const { data: mov, error: errMov } = await supabase
            .from("movimientos")
            .insert({
              tipo: "Retiro",
              item_id: it.item_id,
              cantidad: it.cantidad,
              obra_id: input.obra_id ?? null,
              ejecutado_por: userId ?? null,
              observaciones: `Entrega vía remito ${remitoIdReal}` +
                (input.cliente_id ? " (entrega directa)" : ""),
            } as any)
            .select()
            .single();
          if (errMov) throw errMov;
          movimientoIdFinal = (mov as any).id;
        }

        itemsParaInsertar.push({
          item_id: it.item_id,
          descripcion_libre: it.descripcion_libre ?? null,
          unidad: it.unidad ?? null,
          movimiento_id: movimientoIdFinal,
          cantidad: it.cantidad,
          observaciones: it.observaciones ?? null,
        });
      }

      // Crear los items vinculados
      if (itemsParaInsertar.length > 0) {
        // Necesitamos buscar la descripción del inventario para los que tienen item_id
        // (porque la tabla tiene una columna 'descripcion' que arrastra el nombre del ítem)
        const itemIds = itemsParaInsertar
          .filter(it => it.item_id)
          .map(it => it.item_id as string);
        let descripcionesPorId: Record<string, string> = {};
        if (itemIds.length > 0) {
          const { data: invs } = await supabase
            .from("inventario")
            .select("id, descripcion")
            .in("id", itemIds);
          for (const inv of (invs ?? []) as any[]) {
            descripcionesPorId[inv.id] = inv.descripcion;
          }
        }

        const rows = itemsParaInsertar.map(it => ({
          remito_id: remRow.id,
          item_id: it.item_id,
          // descripcion: del inventario o la libre
          descripcion: it.item_id
            ? (descripcionesPorId[it.item_id] ?? "—")
            : (it.descripcion_libre ?? "—"),
          descripcion_libre: it.descripcion_libre,
          unidad: it.unidad,
          movimiento_id: it.movimiento_id,
          cantidad: it.cantidad,
          observaciones: it.observaciones,
        }));
        const { error: errItems } = await supabase.from("remito_items").insert(rows as any);
        if (errItems) throw errItems;
      }

      return remRow as Remito;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ["items_remitables"] });
      qc.invalidateQueries({ queryKey: ["inventario"] });
      qc.invalidateQueries({ queryKey: ["movimientos"] });
    },
  });
}

export function useEditarRemito() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: {
      id: string;
      patch: Partial<{
        fecha: string;
        recibido_por: string | null;
        dni_receptor: string | null;
        fecha_recepcion: string | null;
        observaciones: string | null;
      }>;
    }) => {
      const { data, error } = await supabase
        .from("remitos")
        .update(patch as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Remito;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useEliminarRemito() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("remitos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ["items_remitables"] });
    },
  });
}
