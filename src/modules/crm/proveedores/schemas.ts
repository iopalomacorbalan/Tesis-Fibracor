import { z } from "zod";

export const proveedorSchema = z.object({
  nombre: z.string().min(2, "Nombre requerido"),
  cuit: z.string()
    .regex(/^(\d{2}-?\d{8}-?\d{1})?$/, "CUIT inválido")
    .nullable()
    .optional()
    .or(z.literal("")),
  contacto: z.string().nullable().optional().or(z.literal("")),
  email: z.string().email("Email inválido").nullable().optional().or(z.literal("")),
  telefono: z.string().nullable().optional().or(z.literal("")),
  direccion: z.string().nullable().optional().or(z.literal("")),
  rubros: z.array(z.string()).optional(),
  notas: z.string().nullable().optional().or(z.literal("")),
});

export type ProveedorFormValues = z.infer<typeof proveedorSchema>;

// Sugerencias comunes de rubros
export const RUBROS_SUGERIDOS = [
  "Fibra óptica",
  "Cobre / UTP",
  "Herramientas",
  "Equipamiento de red",
  "Materiales eléctricos",
  "Servicios",
  "Insumos generales",
  "Logística",
];
