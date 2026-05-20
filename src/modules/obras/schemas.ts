import { z } from "zod";

export const obraSchema = z.object({
  cliente_id: z.string().uuid("Cliente requerido").nullable(),
  nombre_obra: z.string().min(2, "Nombre requerido"),
  sitio: z.string().nullable().optional(),
  alcance_tecnico: z.string().nullable().optional(),
  maps_url: z.string().nullable().optional().or(z.literal("")),
  fecha_inicio_est: z.string().nullable().optional(),
  fecha_fin_est: z.string().nullable().optional(),
  presupuesto: z.coerce.number().min(0, "Presupuesto inválido").optional(),
  jefe_obra_id: z.string().uuid().nullable().optional(),
  observaciones: z.string().nullable().optional(),
  tecnicos_ids: z.array(z.string().uuid()).optional(),
});

export type ObraFormValues = z.infer<typeof obraSchema>;
