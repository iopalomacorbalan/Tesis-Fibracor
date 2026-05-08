// Tipos de la base de datos
export type UserArea =
  | "Direccion" | "Operaciones" | "Paniol"
  | "Comercial" | "Contabilidad" | "Tecnico";

export type CategoriaItem =
  | "Material" | "Consumo" | "Herramienta" | "Reutilizable" | "Equipo especial";

export type EstadoObra =
  | "Pendiente OIO" | "En ejecucion" | "Para cierre" | "Cerrada" | "Cancelada";

export type TipoMovimiento =
  | "Ingreso_compra" | "Ingreso_inicial" | "Ajuste_positivo" | "Ajuste_negativo"
  | "Retiro" | "Devolucion_pendiente" | "Devolucion" | "Reactivacion" | "Baja"
  | "Transferencia";

export type EstadoCompra =
  | "Solicitada" | "Aprobada" | "Parcial" | "Recibida" | "Rechazada" | "Cancelada";

export type EstadoSolicitud = "Pendiente" | "Parcial" | "Atendida" | "Cancelada";
export type EstadoItemSol = "pendiente" | "en_oc" | "listo" | "entregado" | "cancelado";
export type PrioridadSol = "Normal" | "Alta" | "Urgente";

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

export interface Proveedor {
  id: string;
  proveedor_id: string;
  nombre: string;
  cuit: string | null;
  contacto: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  rubros: string[] | null;
  notas: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Inventario {
  id: string;
  item_id: string;
  descripcion: string;
  categoria: CategoriaItem;
  unidad: string;
  stock_disponible: number;
  stock_en_obra: number;
  stock_fuera_servicio: number;
  stock_minimo: number;
  numero_serie: string | null;
  proveedor_principal_id: string | null;
  precio_costo: number;
  precio_lista: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventarioConProveedor extends Inventario {
  proveedor?: Proveedor | null;
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

export interface Movimiento {
  id: string;
  mov_id: string;
  tipo: TipoMovimiento;
  item_id: string;
  cantidad: number;
  obra_id: string | null;
  tecnico_id: string | null;
  ejecutado_por: string | null;
  compra_id: string | null;
  solicitud_id: string | null;
  remito_id: string | null;
  movimiento_padre_id: string | null;
  estado_herramienta: string | null;
  observaciones: string | null;
  fecha: string;
  created_at: string;
}

export interface MovimientoConRelaciones extends Movimiento {
  item?: Inventario | null;
  obra?: Obra | null;
  tecnico?: Usuario | null;
  ejecutor?: Usuario | null;
}

export interface Solicitud {
  id: string;
  solicitud_id: string;
  obra_id: string | null;
  tecnico_id: string | null;
  destinatario_id: string | null;
  prioridad: PrioridadSol;
  estado: EstadoSolicitud;
  observaciones: string | null;
  fecha_solicitud: string;
  fecha_atencion: string | null;
  created_at: string;
  updated_at: string;
}

export interface SolicitudItem {
  id: string;
  solicitud_id: string;
  item_id: string | null;
  descripcion_libre: string | null;
  cantidad: number;
  unidad: string;
  estado: EstadoItemSol;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
}

export interface SolicitudItemConRelaciones extends SolicitudItem {
  item?: Inventario | null;
}

export interface SolicitudConRelaciones extends Solicitud {
  obra?: Obra | null;
  tecnico?: Usuario | null;
  destinatario?: Usuario | null;
  items?: SolicitudItemConRelaciones[];
}

export interface Compra {
  id: string;
  compra_id: string;
  proveedor_id: string | null;
  obra_id: string | null;
  fecha_solicitud: string;
  fecha_aprobacion: string | null;
  fecha_recepcion: string | null;
  estado: EstadoCompra;
  solicitado_por: string | null;
  aprobador_id: string | null;
  total_estimado: number | null;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompraItem {
  id: string;
  compra_id: string;
  item_id: string;
  descripcion: string;
  cantidad_solicitada: number;
  cantidad_recibida: number;
  precio_unitario: number;
  observaciones: string | null;
  created_at: string;
}

export interface CompraItemConRelaciones extends CompraItem {
  item?: Inventario | null;
}

export interface CompraConRelaciones extends Compra {
  proveedor?: Proveedor | null;
  obra?: Obra | null;
  solicitante?: Usuario | null;
  items?: CompraItemConRelaciones[];
}

export interface Reporte {
  id: string;
  reporte_id: string;
  obra_id: string;
  tecnico_id: string | null;
  fecha: string;
  descripcion: string | null;
  trabajos_realizados: string | null;
  pendientes: string | null;
  created_at: string;
}

export interface Remito {
  id: string;
  remito_id: string;
  obra_id: string | null;
  cliente_id: string | null;
  fecha: string;
  recibido_por: string | null;
  dni_receptor: string | null;
  fecha_recepcion: string | null;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface RemitoItem {
  id: string;
  remito_id: string;
  item_id: string | null;
  descripcion_libre: string | null;
  unidad: string | null;
  movimiento_id: string | null;
  cantidad: number;
  observaciones: string | null;
  created_at: string;
}

export interface RemitoItemConRelaciones extends RemitoItem {
  item?: Inventario | null;
}

export interface RemitoConRelaciones extends Remito {
  obra?: Obra | null;
  cliente?: Cliente | null;
  creador?: Usuario | null;
  items?: RemitoItemConRelaciones[];
}

export interface ReporteFoto {
  id: string;
  reporte_id: string;
  storage_path: string;
  url: string | null;
  caption: string | null;
  uploaded_at: string;
}

export interface ReporteConRelaciones extends Reporte {
  obra?: Obra | null;
  tecnico?: Usuario | null;
  fotos?: ReporteFoto[];
}

// Database type permisivo para Supabase
export interface Database {
  public: { Tables: Record<string, any> };
}
