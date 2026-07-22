import { useState } from "react";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  /** URL de la miniatura (si existe). Se usa primero por ser mucho más liviana. */
  thumbUrl?: string | null;
  /** URL de la imagen original. Fallback si no hay miniatura. */
  url?: string | null;
  alt?: string;
  className?: string;
  onClick?: () => void;
}

/**
 * Imagen con placeholder de carga.
 * Muestra un recuadro gris animado mientras descarga, y usa la miniatura
 * cuando está disponible (mucho más rápido en grillas y listados).
 */
export function FotoThumb({ thumbUrl, url, alt = "Foto", className, onClick }: Props) {
  const [cargada, setCargada] = useState(false);
  const [error, setError] = useState(false);

  // Preferimos la miniatura; si no existe, la original
  const src = thumbUrl || url || "";

  if (!src || error) {
    return (
      <div className={cn("flex items-center justify-center bg-muted text-muted-foreground", className)}>
        <ImageIcon className="h-5 w-5 opacity-40" />
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden bg-muted", className)} onClick={onClick}>
      {/* Placeholder animado mientras carga */}
      {!cargada && (
        <div className="absolute inset-0 animate-pulse bg-muted flex items-center justify-center">
          <ImageIcon className="h-5 w-5 text-muted-foreground opacity-30" />
        </div>
      )}
      <img
        loading="lazy"
        decoding="async"
        src={src}
        alt={alt}
        onLoad={() => setCargada(true)}
        onError={() => setError(true)}
        className={cn(
          "w-full h-full object-cover transition-opacity duration-300",
          cargada ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  );
}
