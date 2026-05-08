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

export interface ObraCostos {
  presupuesto: number;
  // Materiales (retiros desde stock que NO volvieron por devolución)
  materiales: MaterialRetirado[];
  total_materiales_costo: number;
  total_materiales_lista: number;
  // OCs vinculadas a la obra
  ocs: OcVinculada[];
  total_ocs: number;
  // Totales agregados
  total_ejecutado_costo: number;
  total_ejecutado_lista: number;
  margen_costo: number;       // presupuesto - ejecutado_costo
  margen_costo_pct: number;   // %
  margen_lista: number;       // presupuesto - ejecutado_lista (lo que sale al precio facturable)
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
      if (errObra) throw errObra;
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

      // Solo cuenta como costo lo que realmente se consumió (queda en obra al cierre)
      // Nota: las herramientas devueltas no se cuentan como costo
      const materiales: MaterialRetirado[] = [];
      let totalMatCosto = 0;
      let totalMatLista = 0;
      for (const [item_id, info] of consumidoPorItem.entries()) {
        if (info.cantidad <= 0) continue;
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

      // 4. Totales agregados (no se duplica: materiales son insumos, OCs son compras nuevas)
      const totalEjecutadoCosto = totalMatCosto + totalOcs;
      const totalEjecutadoLista = totalMatLista + totalOcs;

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
