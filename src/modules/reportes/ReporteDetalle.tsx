import { useState } from "react";
import { Briefcase, User, Calendar, Camera, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import type { ReporteConRelaciones } from "@/types/database";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reporte: ReporteConRelaciones | null;
}

export function ReporteDetalle({ open, onOpenChange, reporte }: Props) {
  const [fotoZoom, setFotoZoom] = useState<string | null>(null);

  if (!reporte) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{reporte.reporte_id}</DialogTitle>
            <DialogDescription>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs mt-1">
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(reporte.fecha)}</span>
                {reporte.obra && (
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-3 w-3" />
                    {reporte.obra.obra_id} {reporte.obra.nombre_obra && `· ${reporte.obra.nombre_obra}`}
                  </span>
                )}
                {reporte.tecnico && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {reporte.tecnico.nombre}
                  </span>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {reporte.descripcion && (
              <div>
                <h3 className="text-sm font-semibold mb-1">Descripción general</h3>
                <p className="text-sm whitespace-pre-wrap">{reporte.descripcion}</p>
              </div>
            )}

            {reporte.trabajos_realizados && (
              <div>
                <h3 className="text-sm font-semibold mb-1">Trabajos realizados</h3>
                <p className="text-sm whitespace-pre-wrap">{reporte.trabajos_realizados}</p>
              </div>
            )}

            {reporte.pendientes && (
              <div>
                <h3 className="text-sm font-semibold mb-1">Pendientes</h3>
                <p className="text-sm whitespace-pre-wrap">{reporte.pendientes}</p>
              </div>
            )}

            {reporte.fotos && reporte.fotos.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Fotos ({reporte.fotos.length})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {reporte.fotos.map(f => (
                    <button
                      key={f.id}
                      onClick={() => setFotoZoom(f.url)}
                      className="aspect-square rounded-md overflow-hidden border hover:border-primary transition-colors"
                    >
                      <img
                        src={f.url ?? ""}
                        alt={f.caption ?? ""}
                        className="w-full h-full object-cover hover:scale-105 transition-transform"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {fotoZoom && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setFotoZoom(null)}
        >
          <button
            onClick={() => setFotoZoom(null)}
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={fotoZoom}
            alt=""
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
