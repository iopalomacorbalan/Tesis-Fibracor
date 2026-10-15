import { z } from "zod";

const requerido = (msg: string) => z.string({ invalid_type_error: msg }).trim().min(1, msg);

export const clienteSchema = z.object({
  nombre: z.string().trim().min(2, "Nombre requerido (mín. 2 caracteres)"),
  cuit: requerido("CUIT requerido")
    .regex(/^\d{2}-?\d{8}-?\d{1}$/, "CUIT inválido (formato: 20-12345678-9)"),
  contacto: requerido("Persona de contacto requerida"),
  email: requerido("Email requerido").email("Email inválido"),
  telefono: requerido("Teléfono requerido"),
  direccion: requerido("Dirección requerida"),
  // Opcionales: texto libre que no todos los clientes tienen
  notas: z.string().nullable().optional().or(z.literal("")),
  recomendaciones: z.string().nullable().optional().or(z.literal("")),
  recomendaciones_prioridad: z.enum(["normal", "importante", "critico"]).nullable().optional(),
});

export type ClienteFormValues = z.input<typeof clienteSchema>;
