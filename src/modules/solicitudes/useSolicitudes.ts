import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type {
  Solicitud, SolicitudConRelaciones, SolicitudItem, EstadoSolicitud,
  PrioridadSol, EstadoItemSol,
} from "@/types/database";

const KEY = "solicitudes";

export function useSolicitudes(filtroEstado?: EstadoSolicitud[]) {
  return useQuery({
    queryKey: [KEY, { filtroEstado }],
    queryFn: async (): Promise<SolicitudConRelaciones[]> => {
      let q = supabase
        .from("solicitudes")
        .select(`
          *,
          obra:obras(id, obra_id, nombre_obra, sitio, estado),
          tecnico:usuarios!solicitudes_tecnico_id_fkey(id, nombre, area, email),
          destinatario:usuarios!solicitudes_destinatario_id_fkey(id, nombre, area),
          items:solicitud_items(
            *,
            item:inventario(id, item_id, descripcion, categoria, unidad, stock_disponible)
          )
        `);
      if (filtroEstado && filtroEstado.length > 0) {
        q = q.in("estado", filtroEstado);
      }
      const { data, error } = await q.order("fecha_solicitud", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]) as SolicitudConRelaciones[];
    },
  });
}

export function useSolicitud(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, id],
    enabled: !!id,
    queryFn: async (): Promise<SolicitudConRelaciones | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("solicitudes")
        .select(`
          *,
          obra:obras(id, obra_id, nombre_obra, sitio, estado),
          tecnico:usuarios!solicitudes_tecnico_id_fkey(id, nombre, area, email),
          destinatario:usuarios!solicitudes_destinatario_id_fkey(id, nombre, area),
          items:solicitud_items(
            *,
            item:inventario(id, item_id, descripcion, categoria, unidad, stock_disponible)
          )
        `)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as any;
    },
  });
}

type SolicitudInput = {
  obra_id: string | null;
  destinatario_id?: string | null;
  prioridad: PrioridadSol;
  observaciones?: string | null;
  items: Array<{
    item_id: string | null;
    descripcion_libre?: string | null;
    cantidad: number;
    unidad: string;
    observaciones?: string | null;
  }>;
};

async function generarSolicitudId(): Promise<string> {
  const { data } = await supabase.from("solicitudes").select("solicitud_id");
  const max = ((data as any[]) ?? [])
    .map((r: any) => parseInt(String(r.solicitud_id ?? "").split("-").pop() || "0"))
    .reduce((m: number, n: number) => Math.max(m, n), 0);
  return `SOL-${String(max + 1).padStart(3, "0")}`;
}

export function useCrearSolicitud() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SolicitudInput) => {
      const userResp = await supabase.auth.getUser();
      const userId = userResp.data.user?.id;

      // No generamos solicitud_id en el frontend - el trigger BEFORE INSERT
      // 'trg_set_solicitud_id' lo asigna automáticamente y de forma atómica.
      const { data: sol, error } = await supabase
        .from("solicitudes")
        .insert({
          obra_id: input.obra_id,
          tecnico_id: userId,
          destinatario_id: input.destinatario_id ?? null,
          prioridad: input.prioridad,
          estado: "Pendiente",
          observaciones: input.observaciones ?? null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      const solRow = sol as any;

      // Insertar items
      if (input.items.length > 0) {
        const rows = input.items.map(it => ({
          solicitud_id: solRow.id,
          item_id: it.item_id,
          descripcion_libre: it.descripcion_libre ?? null,
          cantidad: it.cantidad,
          unidad: it.unidad,
          estado: "pendiente" as EstadoItemSol,
          observaciones: it.observaciones ?? null,
        }));
        const { error: errItems } = await supabase.from("solicitud_items").insert(rows as any);
        if (errItems) throw errItems;
      }

      return solRow as Solicitud;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useEditarSolicitud() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Solicitud> }) => {
      const { data, error } = await supabase
        .from("solicitudes").update(patch as any).eq("id", id).select().single();
      if (error) throw error;
      return data as Solicitud;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useCambiarEstadoItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, estado }: { itemId: string; estado: EstadoItemSol }) => {
      const { error } = await supabase
        .from("solicitud_items").update({ estado } as any).eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

// Cancelar solicitud completa
export function useCancelarSolicitud() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("solicitudes").update({ estado: "Cancelada" } as any).eq("id", id);
      if (error) throw error;
      // También cancelar todos sus items
      await supabase.from("solicitud_items").update({ estado: "cancelado" } as any).eq("solicitud_id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

// Marcar item como entregado (genera movimiento de Retiro)
export function useEntregarItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      solicitudItemId, itemInventarioId, cantidad, obraId, tecnicoId, observaciones,
    }: {
      solicitudItemId: string;
      itemInventarioId: string;
      cantidad: number;
      obraId: string | null;
      tecnicoId: string | null;
      observaciones?: string;
    }) => {
      // Generar mov_id
      const { data: maxMov } = await supabase.from("movimientos").select("mov_id");
      const maxNum = ((maxMov as any[]) ?? [])
        .map((m: any) => parseInt(String(m.mov_id ?? "").split("-").pop() || "0"))
        .reduce((m: number, n: number) => Math.max(m, n), 0);
      const movId = `MOV-${String(maxNum + 1).padStart(3, "0")}`;

      const userResp = await supabase.auth.getUser();
      const { error: errMov } = await supabase.from("movimientos").insert({
        mov_id: movId,
        tipo: "Retiro",
        item_id: itemInventarioId,
        cantidad,
        obra_id: obraId,
        tecnico_id: tecnicoId,
        ejecutado_por: userResp.data.user?.id ?? null,
        observaciones: observaciones ?? "Entrega desde solicitud",
      } as any);
      if (errMov) throw errMov;

      // Marcar item como entregado
      const { error: errItem } = await supabase
        .from("solicitud_items")
        .update({ estado: "entregado" } as any)
        .eq("id", solicitudItemId);
      if (errItem) throw errItem;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ["inventario"] });
      qc.invalidateQueries({ queryKey: ["movimientos"] });
    },
  });
}
