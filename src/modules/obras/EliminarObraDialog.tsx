import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertTriangle, ClipboardList, GitBranch, FileText, ScrollText, Wallet, Ban, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useEliminarObra, useCambiarEstadoObra } from "./useObras";
import type { ObraConRelaciones } from "@/types/database";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  obra: ObraConRelaciones | null;
}

interface ConteoObra {
  solicitudes: number;
  movimientos: number;
  reportes: number;
  remitos: number;
  compras: number;
  costos_extras: number;
}

function useConteosObra(obraId: string | null) {
  return useQuery({
    queryKey: ["conteos_obra", obraId],
    enabled: !!obraId,
    queryFn: async (): Promise<ConteoObra> => {
      if (!obraId) return {
        solicitudes: 0, movimientos: 0, reportes: 0, remitos: 0, compras: 0, costos_extras: 0
      };
      const [s, m, r, rem, c, ce] = await Promise.all([
        supabase.from("solicitudes").select("id", { count: "exact", head: true }).eq("obra_id", obraId),
        supabase.from("movimientos").select("id", { count: "exact", head: true }).eq("obra_id", obraId),
        supabase.from("reportes").select("id", { count: "exact", head: true }).eq("obra_id", obraId),
        supabase.from("remitos").select("id", { count: "exact", head: true }).eq("obra_id", obraId),
        supabase.from("compras").select("id", { count: "exact", head: true }).eq("obra_id", obraId),
        supabase.from("costos_extras_obra").select("id", { count: "exact", head: true }).eq("obra_id", obraId),
      ]);
      return {
        solicitudes: s.count ?? 0,
        movimientos: m.count ?? 0,
        reportes: r.count ?? 0,
        remitos: rem.count ?? 0,
        compras: c.count ?? 0,
        costos_extras: ce.count ?? 0,
      };
    },
  });
}

export function EliminarObraDialog({ open, onOpenChange, obra }: Props) {
  const { data: conteos, isLoading } = useConteosObra(obra?.id ?? null);
  const eliminar = useEliminarObra();
  const cambiarEstado = useCambiarEstadoObra();

  if (!obra) return null;

  const tieneRemitos = (conteos?.remitos ?? 0) > 0;
  const tieneDatos = conteos && (
    conteos.solicitudes > 0 ||
    conteos.movimientos > 0 ||
    conteos.reportes > 0 ||
    conteos.remitos > 0 ||
    conteos.compras > 0 ||
    conteos.costos_extras > 0
  );

  const handleCancelar = async () => {
    try {
      await cambiarEstado.mutateAsync({ id: obra.id, estado: "Cancelada" });
      toast.success(`Obra ${obra.obra_id} marcada como cancelada`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  const handleEliminar = async () => {
    try {
      await eliminar.mutateAsync(obra.id);
      toast.success(`Obra ${obra.obra_id} eliminada`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Eliminar obra {obra.obra_id}
          </DialogTitle>
          <DialogDescription>
            {obra.cliente?.nombre && <b>{obra.cliente.nombre}</b>}
            {obra.nombre_obra && <> · {obra.nombre_obra}</>}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          </div>
        ) : (
          <div className="space-y-4">
            {tieneDatos ? (
              <>
                <div className="rounded-md bg-warning/10 border border-warning/30 p-3 text-sm">
                  <div className="font-semibold text-warning mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Esta obra tiene datos asociados
                  </div>
                  <ul className="space-y-1 text-xs">
                    {(conteos?.solicitudes ?? 0) > 0 && (
                      <li className="flex items-center gap-2">
                        <ClipboardList className="h-3 w-3" />
                        <b>{conteos!.solicitudes}</b> solicitud(es)
                      </li>
                    )}
                    {(conteos?.movimientos ?? 0) > 0 && (
                      <li className="flex items-center gap-2">
                        <GitBranch className="h-3 w-3" />
                        <b>{conteos!.movimientos}</b> movimiento(s) (retiros / devoluciones)
                      </li>
                    )}
                    {(conteos?.reportes ?? 0) > 0 && (
                      <li className="flex items-center gap-2">
                        <FileText className="h-3 w-3" />
                        <b>{conteos!.reportes}</b> reporte(s) con sus fotos
                      </li>
                    )}
                    {(conteos?.remitos ?? 0) > 0 && (
                      <li className="flex items-center gap-2 text-destructive font-semibold">
                        <ScrollText className="h-3 w-3" />
                        <b>{conteos!.remitos}</b> remito(s) — bloquea la eliminación
                      </li>
                    )}
                    {(conteos?.compras ?? 0) > 0 && (
                      <li className="flex items-center gap-2">
                        <Wallet className="h-3 w-3" />
                        <b>{conteos!.compras}</b> orden(es) de compra
                      </li>
                    )}
                    {(conteos?.costos_extras ?? 0) > 0 && (
                      <li className="flex items-center gap-2">
                        <Wallet className="h-3 w-3" />
                        <b>{conteos!.costos_extras}</b> costo(s) extra cargado(s)
                      </li>
                    )}
                  </ul>
                </div>

                {tieneRemitos ? (
                  <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 text-xs">
                    🚫 No podés eliminar esta obra porque tiene remitos asociados. Eliminá los remitos primero
                    desde la sección Remitos.
                  </div>
                ) : (
                  <div className="rounded-md bg-secondary/50 p-3 text-xs space-y-2">
                    <p className="font-semibold">💡 Recomendación: cancelar en vez de eliminar</p>
                    <p>
                      Si la obra ya no se va a hacer, es mejor <b>cancelarla</b> que eliminarla.
                      Así conservás el historial (movimientos, reportes, etc.) por si necesitás auditar.
                    </p>
                    <p>
                      Si aún así querés eliminar:
                    </p>
                    <ul className="list-disc list-inside text-muted-foreground space-y-0.5 ml-1">
                      <li>Solicitudes, movimientos, reportes y costos extras quedan archivados sin obra (no se borran)</li>
                      <li>Los retiros NO se cancelan automáticamente — el stock no vuelve solo</li>
                      <li>Si hay herramientas asignadas a técnicos, deben devolverse manualmente antes</li>
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-md bg-secondary/50 p-3 text-sm text-muted-foreground">
                Esta obra no tiene datos asociados. Es seguro eliminarla.
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 flex-col sm:flex-row">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={eliminar.isPending || cambiarEstado.isPending}
          >
            No, dejar como está
          </Button>
          {!tieneRemitos && obra.estado !== "Cancelada" && obra.estado !== "Cerrada" && (
            <Button
              variant="outline"
              onClick={handleCancelar}
              disabled={eliminar.isPending || cambiarEstado.isPending}
            >
              {cambiarEstado.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <Ban className="h-4 w-4" />
              Cancelar obra (recomendado)
            </Button>
          )}
          <Button
            variant="destructive"
            onClick={handleEliminar}
            disabled={tieneRemitos || eliminar.isPending || cambiarEstado.isPending}
          >
            {eliminar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            <Trash2 className="h-4 w-4" />
            Eliminar definitivamente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
