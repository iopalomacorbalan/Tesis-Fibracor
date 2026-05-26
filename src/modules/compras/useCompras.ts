import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Compra, CompraConRelaciones, EstadoCompra } from "@/types/database";

const KEY = "compras";

export function useCompras() {
  return useQuery({
    queryKey: [KEY],
    queryFn: async (): Promise<CompraConRelaciones[]> => {
      const { data, error } = await supabase
        .from("compras")
        .select(`
          *,
          proveedor:proveedores(*),
          obra:obras(id, obra_id, nombre_obra),
          solicitante:usuarios!compras_solicitado_por_fkey(id, nombre),
          items:compra_items(
            *,
            item:inventario(id, item_id, descripcion, unidad)
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]) as CompraConRelaciones[];
    },
  });
}

type CompraInput = {
  proveedor_id: string | null;
  obra_id?: string | null;
  moneda?: "ARS" | "USD";
  observaciones?: string | null;
  items: Array<{
    item_id: string;
    descripcion: string;
    cantidad_solicitada: number;
    precio_unitario: number;
    observaciones?: string | null;
  }>;
};

async function generarCompraId(): Promise<string> {
  const { data } = await supabase.from("compras").select("compra_id");
  const max = ((data as any[]) ?? [])
    .map((r: any) => parseInt(String(r.compra_id ?? "").split("-").pop() || "0"))
    .reduce((m: number, n: number) => Math.max(m, n), 0);
  return `OC-${String(max + 1).padStart(3, "0")}`;
}

export function useCrearCompra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CompraInput) => {
      const userResp = await supabase.auth.getUser();
      const userId = userResp.data.user?.id;

      const total = input.items.reduce(
        (sum, it) => sum + (it.cantidad_solicitada * it.precio_unitario),
        0
      );

      // compra_id se asigna por trigger BEFORE INSERT en la BD
      const { data: compra, error } = await supabase
        .from("compras")
        .insert({
          proveedor_id: input.proveedor_id,
          obra_id: input.obra_id ?? null,
          fecha_solicitud: new Date().toISOString().slice(0, 10),
          estado: "Solicitada",
          solicitado_por: userId ?? null,
          total_estimado: total,
          moneda: input.moneda ?? "ARS",
          observaciones: input.observaciones ?? null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      const compraRow = compra as any;

      if (input.items.length > 0) {
        const rows = input.items.map(it => ({
          compra_id: compraRow.id,
          item_id: it.item_id,
          descripcion: it.descripcion,
          cantidad_solicitada: it.cantidad_solicitada,
          cantidad_recibida: 0,
          precio_unitario: it.precio_unitario,
          observaciones: it.observaciones ?? null,
        }));
        const { error: errItems } = await supabase.from("compra_items").insert(rows as any);
        if (errItems) throw errItems;
      }

      return compraRow as Compra;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useCambiarEstadoCompra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: EstadoCompra }) => {
      const patch: any = { estado };
      if (estado === "Aprobada") {
        patch.fecha_aprobacion = new Date().toISOString().slice(0, 10);
      }
      const { error } = await supabase.from("compras").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

// Recibir cantidad de un item de compra → genera Ingreso_compra
type RecibirInput = {
  compra_item_id: string;
  cantidad_recibida: number; // monto a sumar al actual
  item_inventario_id: string;
  precio_unitario: number;
  compra_id: string;
};

export function useRecibirItemCompra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RecibirInput) => {
      // 1. Obtener cantidad actual recibida y total
      const { data: cur } = await supabase
        .from("compra_items")
        .select("cantidad_solicitada, cantidad_recibida")
        .eq("id", input.compra_item_id)
        .single();
      const cancActual = (cur as any)?.cantidad_recibida ?? 0;
      const cantSol = (cur as any)?.cantidad_solicitada ?? 0;
      const nuevaTotal = cancActual + input.cantidad_recibida;
      if (nuevaTotal > cantSol) {
        throw new Error(`Excede la cantidad solicitada (${cantSol})`);
      }

      // 2. Update compra_items
      const { error: errUp } = await supabase
        .from("compra_items")
        .update({ cantidad_recibida: nuevaTotal } as any)
        .eq("id", input.compra_item_id);
      if (errUp) throw errUp;

      // 3. Generar movimiento Ingreso_compra
      const { data: maxMov } = await supabase.from("movimientos").select("mov_id");
      const maxNum = ((maxMov as any[]) ?? [])
        .map((m: any) => parseInt(String(m.mov_id ?? "").split("-").pop() || "0"))
        .reduce((m: number, n: number) => Math.max(m, n), 0);
      const movId = `MOV-${String(maxNum + 1).padStart(3, "0")}`;

      const userResp = await supabase.auth.getUser();
      const { error: errMov } = await supabase.from("movimientos").insert({
        mov_id: movId,
        tipo: "Ingreso_compra",
        item_id: input.item_inventario_id,
        cantidad: input.cantidad_recibida,
        compra_id: input.compra_id,
        ejecutado_por: userResp.data.user?.id ?? null,
        observaciones: `Recepción OC ${input.compra_id}`,
      } as any);
      if (errMov) throw errMov;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ["inventario"] });
      qc.invalidateQueries({ queryKey: ["movimientos"] });
    },
  });
}
