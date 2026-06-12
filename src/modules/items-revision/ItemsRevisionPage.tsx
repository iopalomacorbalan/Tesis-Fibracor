import { useState } from "react";
import { Wrench, Loader2, RotateCcw, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { Navigate } from "react-router-dom";
import { formatDate } from "@/lib/utils";
import {
  useItemsEnRevision, useReactivarItem, useDarBajaItem,
  type ItemEnRevision,
} from "./useItemsRevision";

export default function ItemsRevisionPage() {
  const { profile } = useAuth();
  const { data: items = [], isLoading } = useItemsEnRevision();
  const [accion, setAccion] = useState<{ tipo: "reactivar" | "baja"; item: ItemEnRevision } | null>(null);
  const [observaciones, setObservaciones] = useState("");
  const reactivar = useReactivarItem();
  const darBaja = useDarBajaItem();

  const puedeAcceder = profile && ["Direccion", "Operaciones", "Contabilidad", "Paniol"].includes(profile.area);
  if (profile && !puedeAcceder) {
    return <Navigate to="/" replace />;
  }

  const handleConfirmar = async () => {
    if (!accion) return;
    try {
      if (accion.tipo === "reactivar") {
        await reactivar.mutateAsync({
          movimiento_id: accion.item.movimiento_id,
          observaciones: observaciones || undefined,
        });
        toast.success(`${accion.item.descripcion} vuelve a stock disponible`);
      } else {
        await darBaja.mutateAsync({
          movimiento_id: accion.item.movimiento_id,
          observaciones: observaciones || undefined,
        });
        toast.success(`${accion.item.descripcion} dado de baja`);
      }
      setAccion(null);
      setObservaciones("");
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
          <Wrench className="h-8 w-8 text-warning" />
          Items en revisión
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Items devueltos para evaluación. Decidí si se reparan y vuelven al stock o se dan de baja definitiva.
        </p>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No hay items en revisión 👍
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map(it => (
            <Card key={it.movimiento_id} className="border-warning/30 bg-warning/5">
              <CardContent className="p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold">{it.descripcion}</h3>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-mono text-muted-foreground">
                        {it.item_codigo}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/20 text-warning border border-warning/30">
                        {it.categoria}
                      </span>
                      {it.ubicacion_fisica && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">
                          📍 {it.ubicacion_fisica}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <div>
                        <b>{it.cantidad} {it.unidad}</b>
                        {it.tecnico_nombre && <> · devuelto por <b>{it.tecnico_nombre}</b></>}
                        {it.obra_codigo && <> · obra <b>{it.obra_codigo}</b></>}
                      </div>
                      <div>{formatDate(it.fecha_devolucion)}</div>
                      {it.numero_serie && <div>S/N: {it.numero_serie}</div>}
                      {it.observaciones && (
                        <div className="italic mt-1">"{it.observaciones}"</div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setAccion({ tipo: "reactivar", item: it }); setObservaciones(""); }}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Volver a disponible
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => { setAccion({ tipo: "baja", item: it }); setObservaciones(""); }}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Dar de baja
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de confirmación */}
      <Dialog open={!!accion} onOpenChange={(o) => { if (!o) { setAccion(null); setObservaciones(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {accion?.tipo === "reactivar" ? "Volver a stock disponible" : "Dar de baja"}
            </DialogTitle>
            <DialogDescription>
              {accion?.tipo === "reactivar" ? (
                <>El item <b>{accion?.item.descripcion}</b> ({accion?.item.cantidad} {accion?.item.unidad}) vuelve al stock disponible.</>
              ) : (
                <span className="flex items-start gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>El item <b>{accion?.item.descripcion}</b> ({accion?.item.cantidad} {accion?.item.unidad}) será dado de baja definitivamente. Esta acción queda registrada en el historial.</span>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Observaciones (opcional)</Label>
            <Textarea
              rows={3}
              placeholder={accion?.tipo === "reactivar"
                ? "Ej: reparado, cambio de pieza X..."
                : "Ej: irreparable, fin de vida útil..."}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAccion(null); setObservaciones(""); }}>
              Cancelar
            </Button>
            <Button
              variant={accion?.tipo === "baja" ? "destructive" : "default"}
              onClick={handleConfirmar}
              disabled={reactivar.isPending || darBaja.isPending}
            >
              {(reactivar.isPending || darBaja.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
