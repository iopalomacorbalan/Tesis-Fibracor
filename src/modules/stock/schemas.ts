import { z } from "zod";

export const itemSchema = z.object({
  descripcion: z.string().min(2, "Descripción requerida"),
  categoria: z.enum(["Material", "Consumo", "Herramienta", "Reutilizable", "Equipo especial"]),
  unidad: z.string().min(1, "Unidad requerida"),
  stock_inicial: z.coerce.number().min(0).optional(),
  stock_minimo: z.coerce.number().min(0).optional(),
  numero_serie: z.string().nullable().optional().or(z.literal("")),
  proveedor_principal_id: z.string().uuid().nullable().optional(),
  precio_costo: z.coerce.number().min(0).optional(),
  precio_lista: z.coerce.number().min(0).optional(),
});

export type ItemFormValues = z.infer<typeof itemSchema>;

export const ajusteSchema = z.object({
  cantidad: z.coerce.number().positive("Cantidad debe ser mayor a 0"),
  tipo: z.enum(["Ajuste_positivo", "Ajuste_negativo"]),
  motivo: z.string().min(3, "Motivo requerido"),
});

export type AjusteFormValues = z.infer<typeof ajusteSchema>;
