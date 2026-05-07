// Tipos de la base de datos
export type UserArea =
  | "Direccion" | "Operaciones" | "Paniol"
  | "Comercial" | "Contabilidad" | "Tecnico";

export type CategoriaItem =
  | "Material" | "Consumo" | "Herramienta" | "Reutilizable" | "Equipo especial";

export type EstadoObra =
  | "Pendiente OIO" | "En ejecucion" | "Para cierre" | "Cerrada" | "Cancelada";

export interface Usuario {
  id: string;
  user_id: string;
  nombre: string;
  email: string;
  area: UserArea;
  rol: string | null;
  activo: boolean;
  ultimo_acceso: string | null;
  modulos_custom: any | null;
  permisos_custom: any | null;
  created_at: string;
  updated_at: string;
}

export interface Cliente {
  id: string;
  cliente_id: string;
  nombre: string;
  cuit: string | null;
  contacto: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  notas: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Obra {
  id: string;
  obra_id: string;
  cliente_id: string | null;
  nombre_obra: string | null;
  sitio: string | null;
  alcance_tecnico: string | null;
  fecha_inicio_est: string | null;
  fecha_fin_est: string | null;
  fecha_inicio_real: string | null;
  fecha_fin_real: string | null;
  presupuesto: number;
  estado: EstadoObra;
  jefe_obra_id: string | null;
  google_calendar_event_id: string | null;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  created_by: string | null;
}

export interface ObraConRelaciones extends Obra {
  cliente?: Cliente | null;
  jefe_obra?: Usuario | null;
  tecnicos?: Usuario[];
}

export interface ObraTecnico {
  obra_id: string;
  tecnico_id: string;
  asignado_at: string;
}

export interface Database {
  public: {
    Tables: {
      usuarios: {
        Row: Usuario;
        Insert: Omit<Usuario, "created_at" | "updated_at">;
        Update: Partial<Omit<Usuario, "id" | "created_at">>;
      };
      clientes: {
        Row: Cliente;
        Insert: Omit<Cliente, "id" | "created_at" | "updated_at" | "deleted_at">;
        Update: Partial<Omit<Cliente, "id" | "created_at">>;
      };
      obras: {
        Row: Obra;
        Insert: Omit<Obra, "id" | "created_at" | "updated_at" | "closed_at">;
        Update: Partial<Omit<Obra, "id" | "created_at">>;
      };
      obra_tecnicos: {
        Row: ObraTecnico;
        Insert: Omit<ObraTecnico, "asignado_at">;
        Update: Partial<ObraTecnico>;
      };
    };
  };
}
