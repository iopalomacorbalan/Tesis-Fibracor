import { Briefcase, Building2, Calendar, FileDown, Loader2, Mail, Phone, User } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { cn, formatDate, formatCurrency } from "@/lib/utils";
import type { CompraConRelaciones, EstadoCompra } from "@/types/database";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  compra: CompraConRelaciones | null;
  onExportar?: () => void;
}

const ESTADO_COLOR: Record<EstadoCompra, string> = {
  "Solicitada": "bg-warning/15 text-warning border-warning/30",
  "Aprobada":   "bg-primary/15 text-primary border-primary/30",
  "Parcial":    "bg-primary/15 text-primary border-primary/30",
  "Recibida":   "bg-success/15 text-success border-success/30",
  "Rechazada":  "bg-destructive/15 text-destructive border-destructive/30",
  "Cancelada":  "bg-muted text-muted-foreground border-border",
};

export function CompraDetalle({ open, onOpenChange, compra, onExportar }: Props) {
  const { profile } = useAuth();
  const puedeVerPrecios = profile && ["Direccion", "Operaciones", "Contabilidad"].includes(profile.area);

  if (!compra) return null;

  const totalCalc = (compra.items ?? []).reduce(
    (s, it) => s + it.cantidad_solicitada * it.precio_unitario, 0
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <span className="text-xl sm:text-2xl">{compra.compra_id}</span>
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold border whitespace-nowrap",
              ESTADO_COLOR[compra.estado]
            )}>
              {compra.estado}
            </span>
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{compra.proveedor?.nombre ?? "Sin proveedor"}</span>
            {compra.obra?.obra_id && <> · Obra {compra.obra.obra_id}</>}
          </DialogDescription>
          {onExportar && (
            <div className="pt-2">
              <Button variant="outline" size="sm" onClick={onExportar}>
                <FileDown className="h-3.5 w-3.5" />
                Exportar PDF
              </Button>
            </div>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {/* PROVEEDOR */}
          <Card>
            <CardContent className="p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Proveedor
              </h3>
              <div className="text-base font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                {compra.proveedor?.nombre ?? "—"}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {compra.proveedor?.cuit && (
                  <span>CUIT: <b>{compra.proveedor.cuit}</b></span>
                )}
                {compra.proveedor?.contacto && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" /> {compra.proveedor.contacto}
                  </span>
                )}
                {compra.proveedor?.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" /> {compra.proveedor.email}
                  </span>
                )}
                {compra.proveedor?.telefono && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {compra.proveedor.telefono}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* DATOS DE LA OC */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <InfoCard
              icon={<Calendar className="h-4 w-4" />}
              label="Fecha solicitud"
              value={formatDate(compra.fecha_solicitud)}
            />
            {compra.fecha_aprobacion && (
              <InfoCard
                icon={<Calendar className="h-4 w-4 text-success" />}
                label="Aprobada"
                value={formatDate(compra.fecha_aprobacion)}
              />
            )}
            {compra.fecha_recepcion && (
              <InfoCard
                icon={<Calendar className="h-4 w-4 text-primary" />}
                label="Recibida"
                value={formatDate(compra.fecha_recepcion)}
              />
            )}
            {compra.obra && (
              <InfoCard
                icon={<Briefcase className="h-4 w-4" />}
                label="Obra vinculada"
                value={compra.obra.obra_id}
              />
            )}
          </div>

          {/* ÍTEMS */}
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-3">
                Ítems solicitados ({(compra.items ?? []).length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b border-border">
                    <tr className="text-left">
                      <th className="py-2 pr-2">Ítem</th>
                      <th className="py-2 pr-2 text-right">Cant.</th>
                      <th className="py-2 pr-2 text-right">Recibido</th>
                      {puedeVerPrecios && (
                        <>
                          <th className="py-2 pr-2 text-right">Precio unit.</th>
                          <th className="py-2 text-right">Subtotal</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {(compra.items ?? []).map(it => {
                      const completo = it.cantidad_recibida >= it.cantidad_solicitada;
                      const subtotal = it.cantidad_solicitada * it.precio_unitario;
                      return (
                        <tr key={it.id} className="border-b border-border/50">
                          <td className="py-2 pr-2">
                            <div className="font-medium">{it.descripcion}</div>
                            {(it as any).item?.item_id && (
                              <div className="text-[10px] text-muted-foreground">
                                {(it as any).item.item_id}
                              </div>
                            )}
                          </td>
                          <td className="py-2 pr-2 text-right">
                            {it.cantidad_solicitada} {(it as any).item?.unidad ?? ""}
                          </td>
                          <td className="py-2 pr-2 text-right">
                            <span className={cn(
                              "font-medium",
                              completo ? "text-success" : "text-warning"
                            )}>
                              {it.cantidad_recibida}
                            </span>
                          </td>
                          {puedeVerPrecios && (
                            <>
                              <td className="py-2 pr-2 text-right">
                                {formatCurrency(it.precio_unitario)}
                              </td>
                              <td className="py-2 text-right font-semibold">
                                {formatCurrency(subtotal)}
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                  {puedeVerPrecios && (compra.items ?? []).length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-border">
                        <td colSpan={3} className="pt-2 text-right text-xs text-muted-foreground">
                          Total estimado:
                        </td>
                        <td colSpan={2} className="pt-2 text-right text-lg font-bold text-primary">
                          {formatCurrency(totalCalc)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </CardContent>
          </Card>

          {/* OBSERVACIONES */}
          {compra.observaciones && (
            <Card>
              <CardContent className="p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Observaciones
                </h3>
                <p className="text-sm whitespace-pre-wrap">{compra.observaciones}</p>
              </CardContent>
            </Card>
          )}

          {/* CREADOR */}
          {(compra as any).solicitante && (
            <div className="text-xs text-muted-foreground text-right">
              Solicitada por <b>{(compra as any).solicitante.nombre}</b>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoCard({ icon, label, value }: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}
