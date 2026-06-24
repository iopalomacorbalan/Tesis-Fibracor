import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export const CATEGORIAS_CAJA = [
  "Combustible", "Viáticos", "Materiales", "Herramientas",
  "Peajes", "Comida", "Librería", "Mantenimiento vehículo",
  "Servicios", "Impuestos/Tasas", "Otros",
] as const;

export const MEDIOS_PAGO = ["Efectivo", "Transferencia", "Tarjeta", "Cheque"] as const;

export interface CajaChicaGasto {
  id: string;
  tipo: "obra" | "administrativo";
  obra_id: string | null;
  categoria: string;
  concepto: string;
  monto: number;
  fecha: string;
  comprobante_url: string | null;
  medio_pago: string | null;
  descuenta_caja: boolean;
  observaciones: string | null;
  costo_extra_id: string | null;
  created_at: string;
  created_by: string | null;
  creador?: { nombre: string } | null;
  obra?: { id: string; obra_id: string; nombre_obra: string | null; cliente?: { nombre: string } | null } | null;
}

const KEY = "caja_chica";

export function useCajaChica(desde?: string, hasta?: string) {
  return useQuery({
    queryKey: [KEY, desde, hasta],
    queryFn: async (): Promise<CajaChicaGasto[]> => {
      let q = supabase
        .from("caja_chica")
        .select(`*, obra:obras(id, obra_id, nombre_obra, cliente:clientes(nombre)), creador:usuarios(nombre)`)
        .order("fecha", { ascending: false });
      if (desde) q = q.gte("fecha", desde);
      if (hasta) q = q.lte("fecha", hasta);
      const { data, error } = await q;
      if (error) { console.warn("Error caja chica:", error.message); return []; }
      return (data ?? []) as CajaChicaGasto[];
    },
  });
}

async function subirComprobante(file: File): Promise<string | null> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const nombre = `comprobante_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("caja-chica").upload(nombre, file, {
    cacheControl: "3600", upsert: false,
  });
  if (error) { console.warn("Error subiendo comprobante:", error.message); return null; }
  const { data } = supabase.storage.from("caja-chica").getPublicUrl(nombre);
  return data.publicUrl;
}

export function useAgregarGasto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      tipo: "obra" | "administrativo";
      obra_id: string | null;
      categoria: string;
      concepto: string;
      monto: number;
      fecha: string;
      medio_pago: string | null;
      observaciones: string | null;
      descuenta_caja: boolean;
      comprobante?: File | null;
    }) => {
      const userResp = await supabase.auth.getUser();
      const uid = userResp.data.user?.id ?? null;

      // Subir comprobante si hay
      let comprobante_url: string | null = null;
      if (input.comprobante) {
        comprobante_url = await subirComprobante(input.comprobante);
      }

      // Si es gasto de obra, crear primero el costo extra (centro de costos)
      let costo_extra_id: string | null = null;
      if (input.tipo === "obra" && input.obra_id) {
        const { data: ce, error: errCe } = await supabase
          .from("costos_extras_obra")
          .insert({
            obra_id: input.obra_id,
            concepto: `[Caja chica] ${input.categoria}: ${input.concepto}`,
            monto: input.monto,
            observaciones: input.observaciones ?? null,
            created_by: uid,
          })
          .select("id")
          .single();
        if (errCe) throw errCe;
        costo_extra_id = ce?.id ?? null;
      }

      const { error } = await supabase.from("caja_chica").insert({
        tipo: input.tipo,
        obra_id: input.tipo === "obra" ? input.obra_id : null,
        categoria: input.categoria,
        concepto: input.concepto,
        monto: input.monto,
        fecha: input.fecha,
        comprobante_url,
        medio_pago: input.medio_pago,
        observaciones: input.observaciones,
        descuenta_caja: input.descuenta_caja,
        costo_extra_id,
        created_by: uid,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ["costos_extras"] });
      qc.invalidateQueries({ queryKey: ["obra_costos"] });
      qc.invalidateQueries({ queryKey: ["caja_saldo"] });
    },
  });
}

export function useEliminarGasto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (gasto: CajaChicaGasto) => {
      // Si tenía costo extra vinculado, borrarlo también
      if (gasto.costo_extra_id) {
        await supabase.from("costos_extras_obra").delete().eq("id", gasto.costo_extra_id);
      }
      const { error } = await supabase.from("caja_chica").delete().eq("id", gasto.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: ["costos_extras"] });
      qc.invalidateQueries({ queryKey: ["obra_costos"] });
      qc.invalidateQueries({ queryKey: ["caja_saldo"] });
    },
  });
}

// ===== Saldo y movimientos de caja =====
export interface CajaMovimiento {
  id: string;
  tipo: "ingreso" | "ajuste";
  monto: number;
  concepto: string | null;
  fecha: string;
  created_at: string;
  created_by: string | null;
  creador?: { nombre: string } | null;
}

export function useSaldoCaja() {
  return useQuery({
    queryKey: ["caja_saldo"],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc("get_saldo_caja_chica");
      if (error) { console.warn("Error saldo caja:", error.message); return 0; }
      return Number(data) || 0;
    },
  });
}

export function useMovimientosCaja() {
  return useQuery({
    queryKey: ["caja_movimientos"],
    queryFn: async (): Promise<CajaMovimiento[]> => {
      const { data, error } = await supabase
        .from("caja_chica_movimientos")
        .select("*, creador:usuarios(nombre)")
        .order("created_at", { ascending: false });
      if (error) { console.warn(error.message); return []; }
      return (data ?? []) as CajaMovimiento[];
    },
  });
}

export function useAgregarMovimientoCaja() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { tipo: "ingreso" | "ajuste"; monto: number; concepto: string | null; fecha: string }) => {
      const userResp = await supabase.auth.getUser();
      const uid = userResp.data.user?.id ?? null;
      const { error } = await supabase.from("caja_chica_movimientos").insert({
        tipo: input.tipo, monto: input.monto, concepto: input.concepto, fecha: input.fecha, created_by: uid,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["caja_saldo"] });
      qc.invalidateQueries({ queryKey: ["caja_movimientos"] });
    },
  });
}
