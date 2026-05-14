import { useState } from "react";
import { Package2, UserPlus, History, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useTecnicos } from "@/modules/obras/useUsuarios";
import { useHerramientasPersonales } from "./useAsignacionesPersonales";
import { AsignarPersonalDialog } from "./AsignarPersonalDialog";
import { DevolucionPersonalDialog } from "./DevolucionPersonalDialog";
import { formatDate } from "@/lib/utils";
import { Navigate } from "react-router-dom";

export default function AsignacionesPersonalesPage() {
  const { profile } = useAuth();
  const { data: tecnicos = [], isLoading } = useTecnicos();
  const [tecnicoSeleccionado, setTecnicoSeleccionado] = useState<string | null>(null);
  const [asignarOpen, setAsignarOpen] = useState(false);
  const [devolucion, setDevolucion] = useState<{ itemId: string; itemNombre: string; cantidad: number } | null>(null);

  // Solo pañol, dirección, operaciones acceden
  const puedeAcceder = profile && ["Paniol", "Direccion", "Operaciones"].includes(profile.area);
  if (profile && !puedeAcceder) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
            <Package2 className="h-8 w-8 text-primary" />
            Herramientas de uso diario
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Items asignados personalmente a técnicos (sin vinculación a obra)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
        {/* Lista de técnicos */}
        <Card>
          <CardContent className="p-3">
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Técnicos</h3>
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin mx-auto my-4" />
            ) : tecnicos.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Sin técnicos activos</p>
            ) : (
              <div className="space-y-1">
                {tecnicos.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTecnicoSeleccionado(t.id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                      tecnicoSeleccionado === t.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                  >
                    {t.nombre}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detalle de herramientas asignadas */}
        <div className="space-y-3">
          {!tecnicoSeleccionado ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Seleccioná un técnico para ver sus herramientas asignadas
              </CardContent>
            </Card>
          ) : (
            <DetalleTecnico
              tecnicoId={tecnicoSeleccionado}
              tecnicoNombre={tecnicos.find(t => t.id === tecnicoSeleccionado)?.nombre ?? ""}
              onAsignar={() => setAsignarOpen(true)}
              onSolicitarDevolucion={(it) => setDevolucion(it)}
            />
          )}
        </div>
      </div>

      {tecnicoSeleccionado && (
        <>
          <AsignarPersonalDialog
            open={asignarOpen}
            onOpenChange={setAsignarOpen}
            tecnicoId={tecnicoSeleccionado}
            tecnicoNombre={tecnicos.find(t => t.id === tecnicoSeleccionado)?.nombre ?? ""}
          />
          {devolucion && (
            <DevolucionPersonalDialog
              open
              onOpenChange={(o) => { if (!o) setDevolucion(null); }}
              tecnicoId={tecnicoSeleccionado}
              tecnicoNombre={tecnicos.find(t => t.id === tecnicoSeleccionado)?.nombre ?? ""}
              itemId={devolucion.itemId}
              itemNombre={devolucion.itemNombre}
              cantidadEnPoder={devolucion.cantidad}
            />
          )}
        </>
      )}
    </div>
  );
}

function DetalleTecnico({ tecnicoId, tecnicoNombre, onAsignar, onSolicitarDevolucion }: {
  tecnicoId: string;
  tecnicoNombre: string;
  onAsignar: () => void;
  onSolicitarDevolucion: (it: { itemId: string; itemNombre: string; cantidad: number }) => void;
}) {
  const { data: items = [], isLoading } = useHerramientasPersonales(tecnicoId);

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold">{tecnicoNombre}</h2>
        <Button onClick={onAsignar} size="sm">
          <UserPlus className="h-4 w-4" />
          Asignar items
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No tiene herramientas asignadas personalmente
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map(it => (
            <Card key={it.item_id}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground font-mono">{it.item_codigo}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{it.categoria}</span>
                      {it.ubicacion_fisica && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">
                          📍 {it.ubicacion_fisica}
                        </span>
                      )}
                    </div>
                    <h3 className="font-medium text-sm mt-1">{it.descripcion}</h3>
                    {it.numero_serie && (
                      <p className="text-[11px] text-muted-foreground">S/N: {it.numero_serie}</p>
                    )}
                    {it.ultima_asignacion && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Asignado: {formatDate(it.ultima_asignacion)}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">En poder</div>
                    <div className="text-2xl font-bold text-primary">{it.cantidad_en_poder}</div>
                    <div className="text-[10px] text-muted-foreground">{it.unidad}</div>
                  </div>
                </div>
                <div className="flex gap-2 mt-2 pt-2 border-t flex-wrap">
                  {it.cantidad_pendiente > 0 && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/30">
                      🔔 {it.cantidad_pendiente} pendiente{it.cantidad_pendiente !== 1 ? "s" : ""} de devolución
                    </span>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto"
                    onClick={() => onSolicitarDevolucion({
                      itemId: it.item_id,
                      itemNombre: it.descripcion,
                      cantidad: it.cantidad_en_poder,
                    })}
                  >
                    Solicitar devolución
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
