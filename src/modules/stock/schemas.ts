import { z } from "zod";

export const itemSchema = z.object({
  descripcion: z.string().trim().min(2, "Descripción requerida"),
  categoria: z.enum(["Material", "Consumo", "Herramienta", "Reutilizable", "Equipo especial"]),
  unidad: z.string().min(1, "Unidad requerida"),
  stock_inicial: z.coerce.number().min(0).optional(),
  stock_minimo: z.coerce.number().min(0).optional(),
  numero_serie: z.string().nullable().optional().or(z.literal("")),
  codigo_barras: z.string().nullable().optional().or(z.literal("")),
  proveedor_principal_id: z.string({ invalid_type_error: "Proveedor requerido" }).uuid("Proveedor requerido"),
  // El mínimo > 0 del costo se valida en el formulario, solo para quien puede ver precios
  precio_costo: z.coerce.number().min(0).optional(),
  precio_lista: z.coerce.number().min(0).optional(),
  ubicacion_fisica: z.string().trim().min(1, "Ubicación requerida").max(50, "Máx 50 caracteres"),
}).refine(
  i => i.categoria !== "Equipo especial" || !!i.numero_serie?.trim(),
  { message: "Los equipos especiales llevan número de serie", path: ["numero_serie"] },
);

// En el formulario el proveedor arranca vacío (null); el schema exige que se elija
export type ItemFormValues = Omit<z.input<typeof itemSchema>, "proveedor_principal_id"> & {
  proveedor_principal_id: string | null;
};

export const ajusteSchema = z.object({
  cantidad: z.coerce.number().positive("Cantidad debe ser mayor a 0"),
  tipo: z.enum(["Ajuste_positivo", "Ajuste_negativo"]),
  motivo: z.string().min(3, "Motivo requerido"),
});

export type AjusteFormValues = z.infer<typeof ajusteSchema>;
