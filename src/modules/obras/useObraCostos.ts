import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface MaterialRetirado {
  item_id: string;
  item_codigo: string;
  descripcion: string;
  unidad: string;
  cantidad_total: number;
  precio_costo: number;
  precio_lista: number;
  total_costo: number;
  total_lista: number;
}

export interface OcVinculada {
  id: string;
  compra_id: string;
  proveedor_nombre: string | null;
  fecha_solicitud: string;
  estado: string;
  total_estimado: number;
  cantidad_solicitada: number;
  cantidad_recibida: number;
}

export interface HerramientaUsada {
  item_id: string;
  item_codigo: string;
  descripcion: string;
  categoria: string;
  precio_costo: number;
  tecnico_nombre: string | null;
  cantidad_retirada: number;
  cantidad_devuelta: number;
  cantidad_pendiente: number;
  cantidad_no_devuelta: number;
  estado_final: string; // 'Devuelta' / 'Pendiente' / 'No devuelta'
}

export interface CostoExtraObra {
  id: string;
  concepto: string;
  monto: number;
  observaciones: string | null;
}

export interface ObraCostos {
  presupuesto: number;
  // Materiales (retiros desde stock que NO volvieron por devolución)
  materiales: MaterialRetirado[];
  total_materiales_costo: number;
  total_materiales_lista: number;
  // OCs vinculadas a la obra
  ocs: OcVinculada[];
  total_ocs: number;
  // Herramientas usadas (no consumibles)
  herramientas: HerramientaUsada[];
  total_herramientas_no_devueltas: number; // costo de las que NO volvieron
  // Costos extras (tercerizados, etc)
  costos_extras: CostoExtraObra[];
  total_costos_extras: number;
  // Totales agregados
  total_ejecutado_costo: number;
  total_ejecutado_lista: number;
  margen_costo: number;
  margen_costo_pct: number;
  margen_lista: number;
  margen_lista_pct: number;
}

export function useObraCostos(obraId: string | null) {
  return useQuery({
    queryKey: ["obra_costos", obraId],
    enabled: !!obraId,
    queryFn: async (): Promise<ObraCostos | null> => {
      if (!obraId) return null;

      // 1. Obra para presupuesto
      const { data: obra, error: errObra } = await supabase
        .from("obras").select("presupuesto").eq("id", obraId).single();
      if (errObra) {
        console.warn("No se pudo cargar costos (probablemente sin permisos):", errObra.message);
        return null;
      }
      const presupuesto = (obra as any)?.presupuesto ?? 0;

      // 2. Movimientos de la obra (retiros menos devoluciones aceptadas)
      const { data: movs } = await supabase
        .from("movimientos")
        .select(`
          tipo, cantidad, item_id,
          item:inventario(id, item_id, descripcion, unidad, precio_costo, precio_lista, categoria)
        `)
        .eq("obra_id", obraId)
        .in("tipo", ["Retiro", "Devolucion"]);

      // Agrupar por item: retiro - devoluciones = cantidad realmente consumida
      const consumidoPorItem = new Map<string, {
        codigo: string; descripcion: string; unidad: string;
        precio_costo: number; precio_lista: number; cantidad: number;
        es_consumible: boolean;
      }>();

      for (const m of (movs ?? []) as any[]) {
        if (!m.item) continue;
        const key = m.item.id;
        const cur = consumidoPorItem.get(key) ?? {
          codigo: m.item.item_id,
          descripcion: m.item.descripcion,
          unidad: m.item.unidad,
          precio_costo: m.item.precio_costo ?? 0,
          precio_lista: m.item.precio_lista ?? 0,
          cantidad: 0,
          es_consumible: ["Material", "Consumo"].includes(m.item.categoria),
        };
        if (m.tipo === "Retiro") cur.cantidad += Number(m.cantidad);
        else if (m.tipo === "Devolucion") cur.cantidad -= Number(m.cantidad);
        consumidoPorItem.set(key, cur);
      }

      // Solo MATERIALES CONSUMIBLES cuentan como costo de obra (no herramientas)
      const materiales: MaterialRetirado[] = [];
      let totalMatCosto = 0;
      let totalMatLista = 0;
      for (const [item_id, info] of consumidoPorItem.entries()) {
        if (info.cantidad <= 0) continue;
        if (!info.es_consumible) continue; // herramientas no van como material
        const tCosto = info.cantidad * info.precio_costo;
        const tLista = info.cantidad * info.precio_lista;
        materiales.push({
          item_id,
          item_codigo: info.codigo,
          descripcion: info.descripcion,
          unidad: info.unidad,
          cantidad_total: info.cantidad,
          precio_costo: info.precio_costo,
          precio_lista: info.precio_lista,
          total_costo: tCosto,
          total_lista: tLista,
        });
        totalMatCosto += tCosto;
        totalMatLista += tLista;
      }
      materiales.sort((a, b) => b.total_costo - a.total_costo);

      // 2.5. Herramientas usadas (las consultamos vía RPC para tener el estado final)
      const { data: herramientasData } = await supabase.rpc("get_herramientas_obra", {
        p_obra_id: obraId,
      });
      const herramientas: HerramientaUsada[] = ((herramientasData ?? []) as any[]).map(h => ({
        item_id: h.item_id,
        item_codigo: h.item_codigo,
        descripcion: h.descripcion,
        categoria: h.categoria,
        precio_costo: Number(h.precio_costo) || 0,
        tecnico_nombre: h.tecnico_nombre,
        cantidad_retirada: Number(h.cantidad_retirada) || 0,
        cantidad_devuelta: Number(h.cantidad_devuelta) || 0,
        cantidad_pendiente: Number(h.cantidad_pendiente) || 0,
        cantidad_no_devuelta: Number(h.cantidad_no_devuelta) || 0,
        estado_final: h.estado_final,
      }));
      // Solo las herramientas NO devueltas suman costo (rotas, perdidas, no devueltas)
      const totalHerrNoDev = herramientas
        .filter(h => h.estado_final === "No devuelta")
        .reduce((s, h) => s + (h.cantidad_no_devuelta * h.precio_costo), 0);

      // 2.6. Costos extras (tercerizados, etc.)
      const { data: extrasData } = await supabase
        .from("costos_extras_obra")
        .select("id, concepto, monto, observaciones")
        .eq("obra_id", obraId);
      const costosExtras: CostoExtraObra[] = ((extrasData ?? []) as any[]).map(e => ({
        id: e.id, concepto: e.concepto, monto: Number(e.monto) || 0,
        observaciones: e.observaciones,
      }));
      const totalExtras = costosExtras.reduce((s, e) => s + e.monto, 0);

      // 3. OCs vinculadas a la obra
      const { data: comprasData } = await supabase
        .from("compras")
        .select(`
          id, compra_id, fecha_solicitud, estado, total_estimado,
          proveedor:proveedores(nombre),
          items:compra_items(cantidad_solicitada, cantidad_recibida)
        `)
        .eq("obra_id", obraId);

      const ocs: OcVinculada[] = ((comprasData ?? []) as any[]).map(c => ({
        id: c.id,
        compra_id: c.compra_id,
        proveedor_nombre: c.proveedor?.nombre ?? null,
        fecha_solicitud: c.fecha_solicitud,
        estado: c.estado,
        total_estimado: c.total_estimado ?? 0,
        cantidad_solicitada: (c.items ?? []).reduce((s: number, it: any) => s + Number(it.cantidad_solicitada), 0),
        cantidad_recibida: (c.items ?? []).reduce((s: number, it: any) => s + Number(it.cantidad_recibida), 0),
      }));
      const totalOcs = ocs
        .filter(c => c.estado !== "Cancelada" && c.estado !== "Rechazada")
        .reduce((s, c) => s + c.total_estimado, 0);

      // 4. Totales agregados
      // Costo = materiales consumibles + OCs + herramientas no devueltas + costos extras
      const totalEjecutadoCosto = totalMatCosto + totalOcs + totalHerrNoDev + totalExtras;
      const totalEjecutadoLista = totalMatLista + totalOcs + totalHerrNoDev + totalExtras;

      const margenCosto = presupuesto - totalEjecutadoCosto;
      const margenCostoPct = presupuesto > 0 ? (margenCosto / presupuesto) * 100 : 0;
      const margenLista = presupuesto - totalEjecutadoLista;
      const margenListaPct = presupuesto > 0 ? (margenLista / presupuesto) * 100 : 0;

      return {
        presupuesto,
        materiales,
        total_materiales_costo: totalMatCosto,
        total_materiales_lista: totalMatLista,
        ocs,
        total_ocs: totalOcs,
        herramientas,
        total_herramientas_no_devueltas: totalHerrNoDev,
        costos_extras: costosExtras,
        total_costos_extras: totalExtras,
        total_ejecutado_costo: totalEjecutadoCosto,
        total_ejecutado_lista: totalEjecutadoLista,
        margen_costo: margenCosto,
        margen_costo_pct: margenCostoPct,
        margen_lista: margenLista,
        margen_lista_pct: margenListaPct,
      };
    },
  });
}
