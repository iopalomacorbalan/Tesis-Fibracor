// Placeholder - lo regeneramos con `supabase gen types` cuando tengamos el CLI configurado
export type UserArea =
  | "Direccion"
  | "Operaciones"
  | "Paniol"
  | "Comercial"
  | "Contabilidad"
  | "Tecnico";

export type CategoriaItem =
  | "Material"
  | "Consumo"
  | "Herramienta"
  | "Reutilizable"
  | "Equipo especial";

export type EstadoObra =
  | "Pendiente OIO"
  | "En ejecucion"
  | "Para cierre"
  | "Cerrada"
  | "Cancelada";

export interface Usuario {
  id: string;
  user_id: string;
  nombre: string;
  email: string;
  area: UserArea;
  rol: string | null;
  activo: boolean;
  ultimo_acceso: string | null;
  created_at: string;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      usuarios: {
        Row: Usuario;
        Insert: Omit<Usuario, "created_at" | "updated_at">;
        Update: Partial<Omit<Usuario, "id" | "created_at">>;
      };
    };
  };
}
