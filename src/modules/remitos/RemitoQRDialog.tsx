import { useState, useEffect } from "react";
import QRCode from "qrcode";
import { Download, Copy, Check, ExternalLink, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import type { RemitoConRelaciones } from "@/types/database";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  remito: RemitoConRelaciones | null;
}

export function RemitoQRDialog({ open, onOpenChange, remito }: Props) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copiado, setCopiado] = useState(false);
  const [reseteando, setReseteando] = useState(false);

  const firmado = remito?.firma_estado === "firmado" || !!remito?.recibido_por;
  const puedeResetear = profile && ["Direccion", "Operaciones", "Comercial", "Paniol"].includes(profile.area);

  // URL pública de firma
  const firmaUrl = remito?.firma_token
    ? `${window.location.origin}/firmar/${remito.firma_token}`
    : "";

  useEffect(() => {
    if (open && firmaUrl) {
      QRCode.toDataURL(firmaUrl, {
        width: 320,
        margin: 2,
        color: { dark: "#111111", light: "#ffffff" },
      }).then(setQrDataUrl).catch(() => setQrDataUrl(""));
    }
  }, [open, firmaUrl]);

  const handleDescargar = () => {
    if (!qrDataUrl || !remito) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `QR-${remito.remito_id}.png`;
    a.click();
  };

  const handleCopiar = async () => {
    try {
      await navigator.clipboard.writeText(firmaUrl);
      setCopiado(true);
      toast.success("Link copiado");
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const handleResetear = async () => {
    if (!remito) return;
    if (!confirm("¿Resetear la firma de este remito? El cliente deberá volver a firmar.")) return;
    setReseteando(true);
    try {
      const { error } = await supabase.rpc("resetear_firma_remito", { p_remito_id: remito.id });
      if (error) throw error;
      toast.success("Firma reseteada — el remito vuelve a estar pendiente");
      qc.invalidateQueries({ queryKey: ["remitos"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    } finally {
      setReseteando(false);
    }
  };

  if (!remito) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>QR de firma — {remito.remito_id}</DialogTitle>
          <DialogDescription>
            {firmado
              ? "Este remito ya fue firmado."
              : "El cliente escanea este QR con su celular para firmar la recepción."}
          </DialogDescription>
        </DialogHeader>

        {firmado ? (
          <div className="text-center py-4 space-y-3">
            <div className="text-5xl">✅</div>
            <div>
              <div className="font-semibold text-success">Remito firmado</div>
              {remito.firma_nombre && (
                <div className="text-sm text-muted-foreground mt-1">
                  Recibido por: <b>{remito.firma_nombre}</b>
                  {remito.firma_dni && ` (DNI ${remito.firma_dni})`}
                </div>
              )}
              {remito.firma_fecha && (
                <div className="text-xs text-muted-foreground">
                  {new Date(remito.firma_fecha).toLocaleString("es-AR")}
                </div>
              )}
            </div>
            {remito.firma_imagen && (
              <div className="border rounded-lg p-2 bg-white inline-block">
                <img src={remito.firma_imagen} alt="Firma" className="max-h-24" />
              </div>
            )}
            {puedeResetear && (
              <Button variant="outline" size="sm" onClick={handleResetear} disabled={reseteando} className="mt-2">
                {reseteando ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RotateCcw className="h-4 w-4 mr-1" />}
                Resetear firma (volver a firmar)
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-center">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR de firma" className="w-56 h-56 border rounded-lg" />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleDescargar} disabled={!qrDataUrl}>
                <Download className="h-4 w-4 mr-1" /> Descargar
              </Button>
              <Button variant="outline" className="flex-1" onClick={handleCopiar}>
                {copiado ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                Copiar link
              </Button>
            </div>

            <a
              href={firmaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Previsualizar formulario
            </a>

            <p className="text-[11px] text-muted-foreground text-center">
              Imprimí el QR o mostralo en pantalla. Al firmar, el remito se marca automáticamente como firmado.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
