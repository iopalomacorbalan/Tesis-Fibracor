import { z } from "zod";

const requerido = (msg: string) => z.string({ invalid_type_error: msg }).trim().min(1, msg);

export const proveedorSchema = z.object({
  nombre: z.string().trim().min(2, "Nombre requerido"),
  cuit: requerido("CUIT requerido")
    .regex(/^\d{2}-?\d{8}-?\d{1}$/, "CUIT inválido (formato: 30-12345678-9)"),
  contacto: requerido("Persona de contacto requerida"),
  email: requerido("Email requerido").email("Email inválido"),
  telefono: requerido("Teléfono requerido"),
  direccion: requerido("Dirección requerida"),
  rubros: z.array(z.string()).min(1, "Elegí al menos un rubro"),
  // Opcional: texto libre
  notas: z.string().nullable().optional().or(z.literal("")),
});

export type ProveedorFormValues = z.input<typeof proveedorSchema>;

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
