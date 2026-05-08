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
          creador:usuarios!remitos_created_by_fkey(id, nombre),
          items:remito_items(
            *,
            item:inventario(id, item_id, descripcion, unidad, categoria)
          )
        `);
      if (obraId) q = q.eq("obra_id", obraId);
      const { data, error } = await q.order("fecha", { ascending: false });
      if (error) throw error;
      // Mapear cliente desde obra
      return ((data ?? []) as any[]).map(r => ({
        ...r,
        cliente: r.obra?.cliente ?? null,
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
      return { ...r, cliente: r.obra?.cliente ?? null };
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

type CrearRemitoInput = {
  obra_id: string;
  fecha?: string;
  recibido_por?: string | null;
  dni_receptor?: string | null;
  fecha_recepcion?: string | null;
  observaciones?: string | null;
  items: Array<{
    item_id: string;
    movimiento_id: string | null;
    cantidad: number;
    observaciones?: string | null;
  }>;
};

export function useCrearRemito() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CrearRemitoInput) => {
      const remito_id = await generarRemitoId();
      const userResp = await supabase.auth.getUser();
      const userId = userResp.data.user?.id;

      const { data: rem, error } = await supabase
        .from("remitos")
        .insert({
          remito_id,
          obra_id: input.obra_id,
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

      if (input.items.length > 0) {
        const rows = input.items.map(it => ({
          remito_id: remRow.id,
          item_id: it.item_id,
          movimiento_id: it.movimiento_id,
          cantidad: it.cantidad,
          observaciones: it.observaciones ?? null,
        }));
        const { error: errItems } = await supabase.from("remito_items").insert(rows as any);
        if (errItems) throw errItems;
      }

      return remRow as Remito;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ["items_remitables"] });
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
      // CASCADE elimina los items
      const { error } = await supabase.from("remitos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ["items_remitables"] });
    },
  });
}
