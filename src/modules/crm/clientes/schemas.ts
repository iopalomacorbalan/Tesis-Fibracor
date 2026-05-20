import { z } from "zod";

export const clienteSchema = z.object({
  nombre: z.string().min(2, "Nombre requerido (mín. 2 caracteres)"),
  cuit: z.string()
    .regex(/^(\d{2}-?\d{8}-?\d{1})?$/, "CUIT inválido (formato: 20-12345678-9)")
    .nullable()
    .optional()
    .or(z.literal("")),
  contacto: z.string().nullable().optional().or(z.literal("")),
  email: z.string()
    .email("Email inválido")
    .nullable()
    .optional()
    .or(z.literal("")),
  telefono: z.string().nullable().optional().or(z.literal("")),
  direccion: z.string().nullable().optional().or(z.literal("")),
  notas: z.string().nullable().optional().or(z.literal("")),
  recomendaciones: z.string().nullable().optional().or(z.literal("")),
  recomendaciones_prioridad: z.enum(["normal", "importante", "critico"]).nullable().optional(),
});

export type ClienteFormValues = z.infer<typeof clienteSchema>;
