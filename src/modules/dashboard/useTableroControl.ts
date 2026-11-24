import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface ObraTablero {
  id: string;
  codigo: string;
  nombre: string | null;
  cliente: string | null;
  estado: string;
  presupuesto: number;
  costo: number;
  margen: number;
  margen_pct: number | null;
}

export interface TableroControl {
  obras: {
    cantidad: number;
    presupuesto: number;
    costo: number;
    margen: number;
    obras: ObraTablero[];
  };
  gasto_mensual: { mes: string; compras: number; caja_chica: number }[];
  materiales: { codigo: string; descripcion: string; unidad: string; cantidad: number; total: number }[];
  clientes: {
    total: number;
    con_obra_en_curso: number;
    recurrentes: number;
    top: { nombre: string; obras: number; presupuesto: number }[];
  };
  personal: { nombre: string; horas_mes: number; reportes_mes: number; herramientas_en_poder: number }[];
  plazos: {
    atrasadas: number;
    lista_atrasadas: { id: string; codigo: string; nombre: string | null; fecha_fin_est: string; dias: number }[];
    cerradas: number;
    cerradas_a_tiempo: number;
  };
}

export function useTableroControl(habilitado: boolean) {
  return useQuery({
    queryKey: ["tablero_control"],
    enabled: habilitado,
    staleTime: 60_000,
    retry: false,
    queryFn: async (): Promise<TableroControl> => {
      const { data, error } = await supabase.rpc("get_tablero_control");
      if (error) throw error;
      return data as TableroControl;
    },
  });
}
