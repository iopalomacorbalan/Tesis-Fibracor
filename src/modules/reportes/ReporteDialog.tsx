import { useState, useEffect, useRef } from "react";
import { Loader2, Camera, X, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useCrearReporte } from "./useReportes";
import { useObras } from "@/modules/obras/useObras";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  obraIdFijo?: string;
}

export function ReporteDialog({ open, onOpenChange, obraIdFijo }: Props) {
  const { data: obras = [] } = useObras();
  const crear = useCrearReporte();
  const fileRef = useRef<HTMLInputElement>(null);

  const [obraId, setObraId] = useState<string>(obraIdFijo ?? "");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [descripcion, setDescripcion] = useState("");
  const [trabajos, setTrabajos] = useState("");
  const [pendientes, setPendientes] = useState("");
  const [fotos, setFotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setObraId(obraIdFijo ?? "");
      setFecha(new Date().toISOString().slice(0, 10));
      setDescripcion("");
      setTrabajos("");
      setPendientes("");
      setFotos([]);
      setPreviews([]);
    }
  }, [open, obraIdFijo]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const nuevosPreviews: string[] = [];
    files.forEach(f => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        nuevosPreviews.push(ev.target?.result as string);
        if (nuevosPreviews.length === files.length) {
          setPreviews([...previews, ...nuevosPreviews]);
        }
      };
      reader.readAsDataURL(f);
    });
    setFotos([...fotos, ...files]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeFoto = (idx: number) => {
    setFotos(fotos.filter((_, i) => i !== idx));
    setPreviews(previews.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!obraId) { toast.error("Seleccioná una obra"); return; }
    if (!descripcion && !trabajos) {
      toast.error("Completá descripción o trabajos realizados");
      return;
    }

    try {
      const rep = await crear.mutateAsync({
        obra_id: obraId,
        fecha,
        descripcion: descripcion || undefined,
        trabajos_realizados: trabajos || undefined,
        pendientes: pendientes || undefined,
        fotos: fotos.length > 0 ? fotos : undefined,
      });
      toast.success(`Reporte ${rep.reporte_id} creado${fotos.length > 0 ? ` con ${fotos.length} fotos` : ""}`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo reporte</DialogTitle>
          <DialogDescription>Documentar trabajos en obra con texto y fotos</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Obra *</Label>
              <Select value={obraId} onValueChange={setObraId} disabled={!!obraIdFijo}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar obra..." />
                </SelectTrigger>
                <SelectContent>
                  {obras.map(o => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.obra_id} — {o.nombre_obra ?? o.cliente?.nombre ?? "Sin nombre"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fecha *</Label>
              <Input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descripción general</Label>
            <Textarea
              rows={2}
              placeholder="Resumen del día..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Trabajos realizados</Label>
            <Textarea
              rows={3}
              placeholder="• Tendido de fibra X metros&#10;• Fusión de Y empalmes..."
              value={trabajos}
              onChange={(e) => setTrabajos(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Pendientes / Próximos pasos</Label>
            <Textarea
              rows={2}
              placeholder="Tareas pendientes para próxima visita..."
              value={pendientes}
              onChange={(e) => setPendientes(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Fotos ({fotos.length})</Label>
            <div className="rounded-md border-2 border-dashed border-muted-foreground/25 p-4">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
                id="upload-fotos"
              />
              <div className="flex flex-col items-center gap-2">
                <Camera className="h-8 w-8 text-muted-foreground" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" /> Subir fotos
                </Button>
                <p className="text-xs text-muted-foreground">
                  Podés subir múltiples imágenes a la vez
                </p>
              </div>
            </div>

            {previews.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
                {previews.map((src, idx) => (
                  <div key={idx} className="relative aspect-square">
                    <img
                      src={src}
                      alt={`Foto ${idx + 1}`}
                      className="w-full h-full object-cover rounded-md border"
                    />
                    <button
                      type="button"
                      onClick={() => removeFoto(idx)}
                      className="absolute top-1 right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/80"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={crear.isPending}>
              {crear.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar reporte
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
