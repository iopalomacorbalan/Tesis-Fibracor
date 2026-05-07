import { z } from "zod";

export const solicitudItemSchema = z.object({
  item_id: z.string().uuid().nullable().optional(),
  descripcion_libre: z.string().nullable().optional(),
  cantidad: z.coerce.number().positive("Cantidad > 0"),
  unidad: z.string().min(1, "Unidad requerida"),
  observaciones: z.string().nullable().optional(),
});

export const solicitudSchema = z.object({
  obra_id: z.string().uuid("Obra requerida").nullable(),
  destinatario_id: z.string().uuid().nullable().optional(),
  prioridad: z.enum(["Normal", "Alta", "Urgente"]),
  observaciones: z.string().nullable().optional(),
  items: z.array(solicitudItemSchema).min(1, "Agregá al menos un ítem"),
});

export type SolicitudFormValues = z.infer<typeof solicitudSchema>;
