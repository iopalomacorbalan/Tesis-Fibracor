import { z } from "zod";

const requerido = (msg: string) => z.string({ invalid_type_error: msg }).trim().min(1, msg);

export const obraSchema = z.object({
  cliente_id: z.string({ invalid_type_error: "Cliente requerido" }).uuid("Cliente requerido"),
  nombre_obra: z.string().trim().min(2, "Nombre requerido"),
  sitio: requerido("Sitio / dirección requerido"),
  alcance_tecnico: requerido("Alcance técnico requerido"),
  fecha_inicio_est: requerido("Fecha de inicio requerida"),
  fecha_fin_est: requerido("Fecha de fin requerida"),
  // El mínimo > 0 se valida en el formulario, solo para quien puede ver precios
  presupuesto: z.coerce.number().min(0, "Presupuesto inválido").optional(),
  jefe_obra_id: z.string({ invalid_type_error: "Jefe de obra requerido" }).uuid("Jefe de obra requerido"),
  tecnicos_ids: z.array(z.string().uuid()).min(1, "Asigná al menos un técnico"),
  // Opcionales: no todas las obras los tienen
  maps_url: z.string().nullable().optional().or(z.literal("")),
  observaciones: z.string().nullable().optional(),
}).refine(
  o => !o.fecha_inicio_est || !o.fecha_fin_est || o.fecha_fin_est >= o.fecha_inicio_est,
  { message: "La fecha de fin no puede ser anterior al inicio", path: ["fecha_fin_est"] },
);

// En el formulario los selects arrancan vacíos (null); el schema exige que se completen
export type ObraFormValues = Omit<z.input<typeof obraSchema>, "cliente_id" | "jefe_obra_id"> & {
  cliente_id: string | null;
  jefe_obra_id: string | null;
};
