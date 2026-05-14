import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type {
  Inventario, InventarioConProveedor, Movimiento, MovimientoConRelaciones,
  CategoriaItem,
} from "@/types/database";

const KEY = "inventario";
const KEY_MOV = "movimientos";

export function useInventario(includeInactivos = false) {
  return useQuery({
    queryKey: [KEY, { includeInactivos }],
    queryFn: async (): Promise<InventarioConProveedor[]> => {
      let q = supabase
        .from("inventario")
        .select(`*, proveedor:proveedores(*)`);
      if (!includeInactivos) q = q.eq("activo", true);
      const { data, error } = await q.order("descripcion");
      if (error) throw error;
      return ((data ?? []) as any[]) as InventarioConProveedor[];
    },
  });
}

export function useItem(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, id],
    enabled: !!id,
    queryFn: async (): Promise<InventarioConProveedor | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("inventario")
        .select(`*, proveedor:proveedores(*)`)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as any;
    },
  });
}

export function useItemsFueraServicio() {
  return useQuery({
    queryKey: [KEY, "fuera_servicio"],
    queryFn: async (): Promise<InventarioConProveedor[]> => {
      const { data, error } = await supabase
        .from("inventario")
        .select("*")
        .gt("stock_fuera_servicio", 0);
      if (error) throw error;
      return ((data ?? []) as any[]) as InventarioConProveedor[];
    },
  });
}

type ItemInput = {
  descripcion: string;
  categoria: CategoriaItem;
  unidad?: string;
  stock_inicial?: number;
  stock_minimo?: number;
  numero_serie?: string | null;
  proveedor_principal_id?: string | null;
  precio_costo?: number;
  precio_lista?: number;
  ubicacion_fisica?: string | null;
};

async function generarItemId(categoria: CategoriaItem): Promise<string> {
  const prefixMap: Record<CategoriaItem, string> = {
    "Material": "MAT", "Consumo": "CON", "Herramienta": "HER",
    "Reutilizable": "REU", "Equipo especial": "EQP",
  };
  const prefix = prefixMap[categoria] ?? "ITM";
  const { data } = await supabase
    .from("inventario")
    .select("item_id")
    .like("item_id", `${prefix}-%`);
  const max = ((data as any[]) ?? [])
    .map((r: any) => parseInt(String(r.item_id ?? "").split("-").pop() || "0"))
    .reduce((m: number, n: number) => Math.max(m, n), 0);
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

export function useCrearItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ItemInput) => {
      const item_id = await generarItemId(input.categoria);

      const { data, error } = await supabase
        .from("inventario")
        .insert({
          item_id,
          descripcion: input.descripcion,
          categoria: input.categoria,
          unidad: input.unidad ?? "ud.",
          stock_minimo: input.stock_minimo ?? 0,
          numero_serie: input.numero_serie ?? null,
          proveedor_principal_id: input.proveedor_principal_id ?? null,
          precio_costo: input.precio_costo ?? 0,
          precio_lista: input.precio_lista ?? 0,
          ubicacion_fisica: input.ubicacion_fisica ?? null,
          activo: true,
        } as any)
        .select()
        .single();
      if (error) throw error;
      const itemRow = data as any;

      // Si hay stock inicial, generar movimiento Ingreso_inicial (los triggers lo persisten en stock_disponible)
      if (input.stock_inicial && input.stock_inicial > 0) {
        const { data: maxMov } = await supabase
          .from("movimientos").select("mov_id");
        const maxNum = ((maxMov as any[]) ?? [])
          .map((m: any) => parseInt(String(m.mov_id ?? "").split("-").pop() || "0"))
          .reduce((m: number, n: number) => Math.max(m, n), 0);
        const movId = `MOV-${String(maxNum + 1).padStart(3, "0")}`;

        const userResp = await supabase.auth.getUser();
        await supabase.from("movimientos").insert({
          mov_id: movId,
          tipo: "Ingreso_inicial",
          item_id: itemRow.id,
          cantidad: input.stock_inicial,
          ejecutado_por: userResp.data.user?.id ?? null,
          observaciones: "Carga inicial al crear ítem",
        } as any);
      }

      return itemRow as Inventario;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useEditarItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Inventario> }) => {
      const { data, error } = await supabase
        .from("inventario")
        .update(patch as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Inventario;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useEliminarItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("inventario")
        .update({ activo: false } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

// Ajustar stock manualmente (positivo o negativo)
type AjusteInput = {
  item_id: string;
  cantidad: number;
  motivo: string;
  tipo: "Ajuste_positivo" | "Ajuste_negativo";
};

export function useAjustarStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AjusteInput) => {
      const { data: maxMov } = await supabase
        .from("movimientos").select("mov_id");
      const maxNum = ((maxMov as any[]) ?? [])
        .map((m: any) => parseInt(String(m.mov_id ?? "").split("-").pop() || "0"))
        .reduce((m: number, n: number) => Math.max(m, n), 0);
      const movId = `MOV-${String(maxNum + 1).padStart(3, "0")}`;

      const userResp = await supabase.auth.getUser();
      const { error } = await supabase.from("movimientos").insert({
        mov_id: movId,
        tipo: input.tipo,
        item_id: input.item_id,
        cantidad: input.cantidad,
        ejecutado_por: userResp.data.user?.id ?? null,
        observaciones: input.motivo,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: [KEY_MOV] });
    },
  });
}

// Reactivar / dar de baja desde fuera_servicio (RPC)
type ReactivarInput = {
  item_id: string;
  cantidad: number;
  accion: "reactivar" | "dar_de_baja";
  observaciones?: string;
};

export function useReactivarHerramienta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ReactivarInput) => {
      const { data, error } = await supabase.rpc("reactivar_o_dar_baja_herramienta", {
        p_item_id: input.item_id,
        p_cantidad: input.cantidad,
        p_accion: input.accion,
        p_observaciones: input.observaciones ?? "",
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: [KEY_MOV] });
    },
  });
}

// Movimientos de un ítem específico
export function useMovimientosItem(itemId: string | undefined) {
  return useQuery({
    queryKey: [KEY_MOV, "by_item", itemId],
    enabled: !!itemId,
    queryFn: async (): Promise<MovimientoConRelaciones[]> => {
      if (!itemId) return [];
      const { data, error } = await supabase
        .from("movimientos")
        .select(`
          *,
          obra:obras(id, obra_id, nombre_obra),
          tecnico:usuarios!movimientos_tecnico_id_fkey(id, nombre, email),
          ejecutor:usuarios!movimientos_ejecutado_por_fkey(id, nombre)
        `)
        .eq("item_id", itemId)
        .order("fecha", { ascending: false })
        .limit(100);
      if (error) throw error;
      return ((data ?? []) as any[]) as MovimientoConRelaciones[];
    },
  });
}
