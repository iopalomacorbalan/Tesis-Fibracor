import { useState, useEffect, useRef, useMemo } from "react";
import { Loader2, Camera, X, Upload, Trash2, Users } from "lucide-react";
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
import {
  useCrearReporte, useEditarReporte, useAgregarFotos, useEliminarFoto,
} from "./useReportes";
import { useObras, useObra } from "@/modules/obras/useObras";
import { useUsuarios } from "@/modules/obras/useUsuarios";
import { useAuth } from "@/lib/auth";
import { procesarImagenes } from "@/lib/imageProcessing";
import { TimePicker } from "@/components/ui/time-picker";
import { supabase } from "@/lib/supabase";
import type { ReporteConRelaciones } from "@/types/database";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  obraIdFijo?: string;
  reporte?: ReporteConRelaciones | null; // si viene → modo edición
}

export function ReporteDialog({ open, onOpenChange, obraIdFijo, reporte }: Props) {
  const isEdit = !!reporte;
  const { profile } = useAuth();
  const { data: obras = [] } = useObras();
  const { data: obraActual } = useObra(obraIdFijo ?? "");
  const { data: todosUsuarios = [] } = useUsuarios();
  const crear = useCrearReporte();
  const editar = useEditarReporte();
  const agregarFotos = useAgregarFotos();
  const eliminarFoto = useEliminarFoto();
  const fileRef = useRef<HTMLInputElement>(null);
  const fileRefGaleria = useRef<HTMLInputElement>(null);

  const [obraId, setObraId] = useState<string>(obraIdFijo ?? "");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [descripcion, setDescripcion] = useState("");
  const [trabajos, setTrabajos] = useState("");
  const [pendientes, setPendientes] = useState("");
  const [horaEntrada, setHoraEntrada] = useState("");
  const [horaSalida, setHoraSalida] = useState("");
  const [asistentes, setAsistentes] = useState<string[]>([]);
  const [fotos, setFotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [procesandoFotos, setProcesandoFotos] = useState(false);

  useEffect(() => {
    if (open) {
      if (reporte) {
        // Modo edición - cargar datos existentes
        setObraId(reporte.obra_id);
        setFecha(reporte.fecha.slice(0, 10));
        setDescripcion(reporte.descripcion ?? "");
        setTrabajos(reporte.trabajos_realizados ?? "");
        setPendientes(reporte.pendientes ?? "");
        setHoraEntrada(reporte.hora_entrada?.slice(0, 5) ?? "");
        setHoraSalida(reporte.hora_salida?.slice(0, 5) ?? "");
        setAsistentes((reporte.tecnicos_presentes ?? []).map(t => t.id));
      } else {
        // Modo creación - sin nadie pre-tildado
        setObraId(obraIdFijo ?? "");
        setFecha(new Date().toISOString().slice(0, 10));
        setDescripcion("");
        setTrabajos("");
        setPendientes("");
        setHoraEntrada("");
        setHoraSalida("");
        setAsistentes([]);
      }
      setFotos([]);
      setPreviews([]);
    }
  }, [open, obraIdFijo, reporte]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    // Limpiar inputs primero
    if (fileRef.current) fileRef.current.value = "";
    if (fileRefGaleria.current) fileRefGaleria.current.value = "";

    // Procesar las imágenes (convierte HEIC → JPG, comprime, normaliza)
    setProcesandoFotos(true);
    try {
      const { exitosas, fallidas } = await procesarImagenes(files);

      // Generar previews de las exitosas
      const nuevosPreviews: string[] = [];
      for (const f of exitosas) {
        const url = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target?.result as string);
          reader.readAsDataURL(f);
        });
        nuevosPreviews.push(url);
      }

      setFotos(prev => [...prev, ...exitosas]);
      setPreviews(prev => [...prev, ...nuevosPreviews]);

      if (fallidas.length > 0) {
        toast.error(
          `${fallidas.length} foto(s) no pudieron procesarse: ${fallidas[0].error}`,
          { duration: 5000 }
        );
      }
      if (exitosas.length > 0) {
        toast.success(`${exitosas.length} foto(s) lista(s) para subir`);
      }
    } catch (e: any) {
      toast.error("Error procesando las imágenes: " + e.message);
    } finally {
      setProcesandoFotos(false);
    }
  };

  const removeFotoNueva = (idx: number) => {
    setFotos(fotos.filter((_, i) => i !== idx));
    setPreviews(previews.filter((_, i) => i !== idx));
  };

  const removeFotoExistente = async (foto: any) => {
    if (!confirm("¿Eliminar esta foto?")) return;
    try {
      await eliminarFoto.mutateAsync(foto);
      toast.success("Foto eliminada");
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  const horasCalculadas = useMemo(() => {
    if (!horaEntrada || !horaSalida) return 0;
    const [h1, m1] = horaEntrada.split(":").map(Number);
    const [h2, m2] = horaSalida.split(":").map(Number);
    const start = h1 * 60 + m1;
    const end = h2 * 60 + m2;
    if (end <= start) return 0;
    return (end - start) / 60;
  }, [horaEntrada, horaSalida]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!obraId) { toast.error("Seleccioná una obra"); return; }
    if (!descripcion && !trabajos) {
      toast.error("Completá descripción o trabajos realizados");
      return;
    }
    if (!horaEntrada || !horaSalida) {
      toast.error("Las horas de entrada y salida son obligatorias");
      return;
    }
    if (horasCalculadas <= 0) {
      toast.error("La hora de salida debe ser posterior a la de entrada");
      return;
    }
    if (asistentes.length === 0) {
      toast.error("Tildá al menos un asistente (incluido vos si trabajaste)");
      return;
    }

    try {
      let reporteId: string;
      if (isEdit && reporte) {
        // EDITAR
        await editar.mutateAsync({
          id: reporte.id,
          patch: {
            obra_id: obraId,
            fecha,
            descripcion: descripcion || null,
            trabajos_realizados: trabajos || null,
            pendientes: pendientes || null,
            hora_entrada: horaEntrada,
            hora_salida: horaSalida,
          },
        });
        reporteId = reporte.id;
        // Subir nuevas fotos si las hay
        if (fotos.length > 0) {
          await agregarFotos.mutateAsync({ reporteId: reporte.id, fotos });
        }
        toast.success(`Reporte ${reporte.reporte_id} actualizado`);
      } else {
        // CREAR
        const rep = await crear.mutateAsync({
          obra_id: obraId,
          fecha,
          descripcion: descripcion || undefined,
          trabajos_realizados: trabajos || undefined,
          pendientes: pendientes || undefined,
          hora_entrada: horaEntrada,
          hora_salida: horaSalida,
          fotos: fotos.length > 0 ? fotos : undefined,
        });
        reporteId = rep.id;
        toast.success(`Reporte ${rep.reporte_id} creado${fotos.length > 0 ? ` con ${fotos.length} fotos` : ""}`);
      }

      // Guardar técnicos presentes (siempre se reescribe la lista completa)
      await supabase.from("reporte_tecnicos").delete().eq("reporte_id", reporteId);
      if (asistentes.length > 0) {
        await supabase.from("reporte_tecnicos").insert(
          asistentes.map(tid => ({ reporte_id: reporteId, tecnico_id: tid }))
        );
      }

      onOpenChange(false);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  const fotosExistentes = reporte?.fotos ?? [];
  const loading = crear.isPending || editar.isPending || agregarFotos.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Editar reporte ${reporte?.reporte_id}` : "Nuevo reporte"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Modificar los datos del reporte" : "Documentar trabajos en obra con texto y fotos"}
          </DialogDescription>
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
            <Label>Observaciones / Pendientes / Próximos pasos</Label>
            <Textarea
              rows={2}
              placeholder="Tareas pendientes para próxima visita..."
              value={pendientes}
              onChange={(e) => setPendientes(e.target.value)}
            />
          </div>

          {/* === Horas trabajadas === */}
          <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <Label className="text-base font-semibold">Asistencia y horario *</Label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <TimePicker
                label="Hora de entrada"
                value={horaEntrada}
                onChange={setHoraEntrada}
                required
              />
              <TimePicker
                label="Hora de salida"
                value={horaSalida}
                onChange={setHoraSalida}
                required
              />
            </div>

            {horasCalculadas > 0 && (
              <div className="text-sm text-muted-foreground">
                Total: <b className="text-foreground">{horasCalculadas.toFixed(2)} horas</b>
                {asistentes.length > 0 && (
                  <> · {asistentes.length} asistente{asistentes.length > 1 ? "s" : ""} · <b className="text-primary">{(horasCalculadas * asistentes.length).toFixed(2)} horas-hombre</b></>
                )}
              </div>
            )}

            {/* Asistentes a la obra - todos los usuarios activos, nadie pre-tildado */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">¿Quiénes asistieron? <span className="text-destructive">*</span></Label>
                {asistentes.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {asistentes.length} seleccionado{asistentes.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Marcá a quienes estuvieron presentes (incluido vos si trabajaste). Sólo los marcados van a contar en las horas.
              </p>
              {todosUsuarios.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {todosUsuarios.map(u => {
                    const asignado = obraActual?.tecnicos?.some(t => t.id === u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setAsistentes(prev =>
                            prev.includes(u.id)
                              ? prev.filter(id => id !== u.id)
                              : [...prev, u.id]
                          );
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                          asistentes.includes(u.id)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-muted-foreground border-input hover:border-primary/40"
                        }`}
                      >
                        {u.nombre}
                        {asignado && <span className="ml-1 opacity-60">·</span>}
                        {!asignado && <span className="ml-1 text-[10px] opacity-60">({u.area})</span>}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No hay usuarios activos.</p>
              )}
            </div>
          </div>

          {/* Fotos existentes (en modo edición) */}
          {isEdit && fotosExistentes.length > 0 && (
            <div className="space-y-2">
              <Label>Fotos actuales ({fotosExistentes.length})</Label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {fotosExistentes.map((f: any) => (
                  <div key={f.id} className="relative aspect-square">
                    <img
                      src={f.url}
                      alt=""
                      className="w-full h-full object-cover rounded-md border"
                    />
                    <button
                      type="button"
                      onClick={() => removeFotoExistente(f)}
                      className="absolute top-1 right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/80"
                      title="Eliminar foto"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>{isEdit ? "Agregar fotos nuevas" : "Fotos"} ({fotos.length})</Label>
            <div className="rounded-md border-2 border-dashed border-muted-foreground/25 p-4">
              {/* Input para cámara (solo en mobile) */}
              <input
                ref={fileRef}
                type="file"
                accept="image/*,.heic,.heif"
                multiple
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
                id="upload-fotos-camara"
              />
              {/* Input para galería (sin capture) */}
              <input
                ref={fileRefGaleria}
                type="file"
                accept="image/*,.heic,.heif"
                multiple
                onChange={handleFileChange}
                className="hidden"
                id="upload-fotos-galeria"
              />
              <div className="flex flex-col items-center gap-2">
                {procesandoFotos ? (
                  <>
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                    <p className="text-sm font-medium text-primary">Procesando imágenes...</p>
                    <p className="text-xs text-muted-foreground text-center">
                      Esto puede tardar unos segundos si son fotos de iPhone (HEIC).
                    </p>
                  </>
                ) : (
                  <>
                    <Camera className="h-8 w-8 text-muted-foreground" />
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileRef.current?.click()}
                        disabled={procesandoFotos}
                      >
                        <Camera className="h-3.5 w-3.5" /> Tomar foto
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileRefGaleria.current?.click()}
                        disabled={procesandoFotos}
                      >
                        <Upload className="h-3.5 w-3.5" /> Desde galería
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Podés subir múltiples imágenes a la vez
                    </p>
                  </>
                )}
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
                      onClick={() => removeFotoNueva(idx)}
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
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Guardar cambios" : "Guardar reporte"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
