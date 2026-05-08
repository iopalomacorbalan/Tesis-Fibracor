import { useState, useMemo } from "react";
import { Wrench, Loader2, ArrowLeftRight, Briefcase, Package, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  useHerramientasAsignadas, useSolicitarDevolucion,
} from "@/modules/movimientos/useMovimientos";
import { useTecnicos } from "@/modules/obras/useUsuarios";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface HerramientaAsignada {
  item_id: string;
  item_codigo: string;
  descripcion: string;
  cantidad: number;
  obras: string[] | null;
}

export default function MisHerramientasPage() {
  const { profile } = useAuth();
  const { data: tecnicos = [] } = useTecnicos();

  const esResponsable = profile && ["Direccion", "Operaciones", "Paniol"].includes(profile.area);
  // Si soy técnico, solo veo las mías. Si soy responsable, puedo elegir.
  const [tecnicoSelId, setTecnicoSelId] = useState<string | null>(
    profile?.area === "Tecnico" ? profile.id : null
  );

  const tecnicoIdAUsar = profile?.area === "Tecnico"
    ? profile.id
    : (tecnicoSelId || profile?.id || null);

  const { data: herramientas = [], isLoading } = useHerramientasAsignadas(tecnicoIdAUsar);

  const [herramientaDevolver, setHerramientaDevolver] = useState<HerramientaAsignada | null>(null);

  const total = useMemo(
    () => (herramientas as HerramientaAsignada[]).reduce((s, h) => s + Number(h.cantidad ?? 0), 0),
    [herramientas]
  );

  const tecnicoSeleccionado = tecnicos.find(t => t.id === tecnicoSelId);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
            <Wrench className="h-8 w-8 text-primary" />
            {profile?.area === "Tecnico" ? "Mis herramientas" : "Herramientas asignadas"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {profile?.area === "Tecnico"
              ? "Lo que tenés en tu poder ahora"
              : "Auditá qué tiene cada técnico"}
          </p>
        </div>
      </div>

      {/* Selector de técnico para responsables */}
      {esResponsable && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Label className="font-medium">Ver herramientas de:</Label>
              <Select
                value={tecnicoSelId ?? "yo"}
                onValueChange={(v) => setTecnicoSelId(v === "yo" ? (profile?.id ?? null) : v)}
              >
                <SelectTrigger className="w-[280px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yo">— Mis propias herramientas —</SelectItem>
                  {tecnicos.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Ítems distintos</div>
            <div className="text-3xl font-bold mt-1">{(herramientas as any[]).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Total unidades</div>
            <div className="text-3xl font-bold mt-1 text-primary">{total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Persona</div>
            <div className="text-base font-semibold mt-1 truncate">
              {profile?.area === "Tecnico"
                ? profile.nombre
                : (tecnicoSeleccionado?.nombre ?? profile?.nombre ?? "—")}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista */}
      {isLoading ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">Cargando...</CardContent></Card>
      ) : (herramientas as any[]).length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No hay herramientas asignadas</p>
            <p className="text-xs text-muted-foreground mt-1">
              Cuando pañol entregue una herramienta, va a aparecer acá
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {(herramientas as HerramientaAsignada[]).map(h => (
            <Card key={h.item_id} className="hover:border-primary/40 transition-colors">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold">{h.descripcion}</h3>
                      <span className="text-xs text-muted-foreground">{h.item_codigo}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/15 text-primary border border-primary/30">
                        {Number(h.cantidad)} ud.
                      </span>
                    </div>
                    {h.obras && h.obras.length > 0 && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap mt-1">
                        <Briefcase className="h-3 w-3" />
                        Obra{h.obras.length > 1 && "s"}: <b>{h.obras.join(", ")}</b>
                      </div>
                    )}
                  </div>

                  {/* Solo el técnico dueño puede devolver, o pañol+ */}
                  {(profile?.area === "Tecnico" && profile.id === tecnicoIdAUsar) || esResponsable ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHerramientaDevolver(h)}
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5" />
                      Solicitar devolución
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <DevolucionDialog
        open={!!herramientaDevolver}
        onOpenChange={(o) => !o && setHerramientaDevolver(null)}
        herramienta={herramientaDevolver}
        tecnicoId={tecnicoIdAUsar ?? null}
        obras={herramientaDevolver?.obras ?? null}
      />
    </div>
  );
}

// Modal para solicitar devolución
function DevolucionDialog({
  open, onOpenChange, herramienta, tecnicoId, obras,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  herramienta: HerramientaAsignada | null;
  tecnicoId: string | null;
  obras: string[] | null;
}) {
  const solicitar = useSolicitarDevolucion();
  const [cantidad, setCantidad] = useState(1);
  const [estadoHerramienta, setEstadoHerramienta] = useState("Bueno");
  const [observaciones, setObservaciones] = useState("");

  // Reset al abrir
  useMemo(() => {
    if (open && herramienta) {
      setCantidad(Number(herramienta.cantidad));
      setEstadoHerramienta("Bueno");
      setObservaciones("");
    }
  }, [open, herramienta]);

  if (!herramienta) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cantidad <= 0) {
      toast.error("Cantidad inválida");
      return;
    }
    if (cantidad > Number(herramienta.cantidad)) {
      toast.error(`Máximo ${herramienta.cantidad} ud.`);
      return;
    }
    try {
      // Si tiene 1 sola obra asociada, pasarla; sino null y pañol decide
      // Nota: las obras vienen como obra_id (texto OT-XX), no UUID.
      // Para simplificar, no pasamos obra_id (queda null), y pañol completa al aceptar.
      await solicitar.mutateAsync({
        item_id: herramienta.item_id,
        cantidad,
        obra_id: null, // pañol asocia al aceptar
        estado_herramienta: estadoHerramienta,
        observaciones,
      });
      toast.success("Devolución solicitada — Pañol va a procesarla");
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Solicitar devolución</DialogTitle>
          <DialogDescription>
            <span className="font-medium">{herramienta.descripcion}</span>
            <br />
            <span className="text-xs">
              {herramienta.item_codigo} · Tenés <b>{herramienta.cantidad}</b> ud.
            </span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Cantidad a devolver *</Label>
            <Input
              type="number"
              min="0.01"
              max={Number(herramienta.cantidad)}
              step="0.01"
              value={cantidad}
              onChange={(e) => setCantidad(parseFloat(e.target.value) || 0)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Estado de la herramienta *</Label>
            <Select value={estadoHerramienta} onValueChange={setEstadoHerramienta}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Bueno">✅ Buen estado / operativa</SelectItem>
                <SelectItem value="Necesita mantenimiento">🔧 Necesita mantenimiento</SelectItem>
                <SelectItem value="Dañada">⚠️ Dañada / no funciona</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Observaciones</Label>
            <Textarea
              rows={2}
              placeholder="Detalles, novedades..."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </div>

          <div className="rounded-md bg-secondary/50 p-3 text-xs text-muted-foreground">
            💡 La devolución queda <b>pendiente</b> hasta que pañol la reciba físicamente y la confirme.
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={solicitar.isPending}>
              {solicitar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Solicitar devolución
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
