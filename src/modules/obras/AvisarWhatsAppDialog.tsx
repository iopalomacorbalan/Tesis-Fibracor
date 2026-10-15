import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, MessageCircle, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  linkWhatsApp, mensajeAsignacion, normalizarTelefono, type ObraParaAviso,
} from "@/lib/whatsapp";
import type { Usuario } from "@/types/database";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  obra: ObraParaAviso | null;
  tecnicos: Pick<Usuario, "id" | "nombre" | "telefono">[];
}

function useGuardarTelefono() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ usuarioId, telefono }: { usuarioId: string; telefono: string }) => {
      const { error } = await supabase.rpc("set_telefono_usuario", {
        p_usuario_id: usuarioId,
        p_telefono: telefono,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["usuarios"] });
      qc.invalidateQueries({ queryKey: ["obras"] });
    },
  });
}

export function AvisarWhatsAppDialog({ open, onOpenChange, obra, tecnicos }: Props) {
  const { profile } = useAuth();
  const puedeEditarTelefonos = ["Direccion", "Operaciones"].includes(profile?.area ?? "");
  const guardarTelefono = useGuardarTelefono();

  const [telefonos, setTelefonos] = useState<Record<string, string>>({});
  // Teléfono guardado en la BD por técnico, para saber si hay cambios sin guardar
  const [guardados, setGuardados] = useState<Record<string, string>>({});
  const [enviados, setEnviados] = useState<Set<string>>(new Set());

  // Se inicializa solo al abrir, para no pisar lo que se está tipeando si la lista se refresca
  useEffect(() => {
    if (open) {
      const iniciales = Object.fromEntries(tecnicos.map(t => [t.id, t.telefono ?? ""]));
      setTelefonos(iniciales);
      setGuardados(iniciales);
      setEnviados(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleGuardar = async (usuarioId: string) => {
    const telefono = telefonos[usuarioId] ?? "";
    try {
      await guardarTelefono.mutateAsync({ usuarioId, telefono });
      setGuardados(p => ({ ...p, [usuarioId]: telefono }));
      toast.success("Teléfono guardado");
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  if (!obra) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-[#25D366]" />
            Avisar por WhatsApp
          </DialogTitle>
          <DialogDescription>
            {obra.obra_id} — {obra.nombre_obra}. Tocá "Enviar" para abrir WhatsApp con el mensaje listo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {tecnicos.map(t => {
            const valor = telefonos[t.id] ?? "";
            const normalizado = normalizarTelefono(valor);
            const cambio = valor.trim() !== (guardados[t.id] ?? "").trim();
            const enviado = enviados.has(t.id);
            return (
              <div key={t.id} className="p-3 rounded-md border bg-secondary/30 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm">👤 {t.nombre}</span>
                  {enviado && (
                    <span className="flex items-center gap-1 text-xs text-success">
                      <Check className="h-3 w-3" /> Abierto en WhatsApp
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={valor}
                    onChange={(e) => setTelefonos(p => ({ ...p, [t.id]: e.target.value }))}
                    placeholder="Celular, ej: 351 1234567"
                    className="h-9"
                  />
                  {puedeEditarTelefonos && cambio && (
                    <Button
                      type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0"
                      title="Guardar teléfono"
                      onClick={() => handleGuardar(t.id)}
                      disabled={guardarTelefono.isPending}
                    >
                      {guardarTelefono.isPending
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Save className="h-4 w-4" />}
                    </Button>
                  )}
                  <a
                    href={linkWhatsApp(normalizado, mensajeAsignacion(t.nombre, obra))}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setEnviados(p => new Set(p).add(t.id))}
                    className={cn(
                      "flex items-center gap-1.5 px-3 h-9 rounded-md text-sm font-medium shrink-0",
                      "bg-[#25D366] text-white hover:opacity-90 transition-opacity",
                    )}
                  >
                    <MessageCircle className="h-4 w-4" />
                    Enviar
                  </a>
                </div>
                {valor.trim() && !normalizado && (
                  <p className="text-[11px] text-warning">
                    ⚠️ No reconozco el número. WhatsApp te va a pedir que elijas el contacto.
                  </p>
                )}
                {!valor.trim() && (
                  <p className="text-[11px] text-muted-foreground">
                    Sin teléfono cargado: WhatsApp te va a pedir que elijas el contacto.
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Listo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
