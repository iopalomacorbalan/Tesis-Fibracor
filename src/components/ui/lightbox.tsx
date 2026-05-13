import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, Download } from "lucide-react";

export interface LightboxImage {
  url: string;
  caption?: string | null;
  filename?: string | null;  // si no se provee, se infiere de la URL
}

interface Props {
  images: LightboxImage[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
}

/**
 * Visor de imágenes con:
 *  - Navegación: flechas en pantalla, teclado (← →), swipe en mobile
 *  - Descarga individual
 *  - Cerrar con ESC o click fuera
 *  - Contador "N de M"
 */
export function Lightbox({ images, initialIndex, open, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex);

  // Reset al abrir
  useEffect(() => {
    if (open) setIndex(initialIndex);
  }, [open, initialIndex]);

  const goPrev = useCallback(() => {
    setIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
  }, [images.length]);

  const goNext = useCallback(() => {
    setIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
  }, [images.length]);

  // Teclado: ESC cierra, flechas navegan
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, goPrev, goNext]);

  // Swipe en mobile
  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) {
      if (dx > 0) goPrev();
      else goNext();
    }
    touchStartX.current = null;
  };

  // Bloquear scroll del body cuando está abierto
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  const handleDownload = async () => {
    const img = images[index];
    if (!img.url) return;
    try {
      const res = await fetch(img.url);
      const blob = await res.blob();
      const link = document.createElement("a");
      const obj = URL.createObjectURL(blob);
      link.href = obj;
      // Nombre del archivo
      const ext = blob.type.split("/")[1] || "jpg";
      let filename = img.filename || img.caption || "";
      if (!filename) {
        const urlPath = new URL(img.url).pathname;
        filename = urlPath.split("/").pop() || `imagen-${index + 1}.${ext}`;
      }
      if (!/\.[a-z]+$/i.test(filename)) filename += `.${ext}`;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(obj);
    } catch (e) {
      // Fallback: abre en otra pestaña
      window.open(img.url, "_blank");
    }
  };

  if (!open || images.length === 0) return null;
  const current = images[index];
  const hasMultiple = images.length > 1;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center select-none isolate"
      onClick={onClose}
      style={{ touchAction: "none" }}
    >
      {/* Header con contador y botones */}
      <div
        className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-3 sm:p-4 bg-gradient-to-b from-black/60 to-transparent"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="text-white text-sm font-medium">
          {hasMultiple ? `${index + 1} / ${images.length}` : ""}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleDownload(); }}
            onPointerDown={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-white hover:bg-white/20 rounded-md px-3 py-2 text-sm font-medium"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Descargar</span>
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            onPointerDown={(e) => e.stopPropagation()}
            className="inline-flex items-center justify-center text-white hover:bg-white/20 rounded-md h-9 w-9"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Imagen central con swipe */}
      <div
        className="relative w-full h-full flex items-center justify-center px-4 py-16 sm:px-16"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={current.url}
          alt={current.caption ?? `Imagen ${index + 1}`}
          className="max-w-full max-h-full object-contain"
          draggable={false}
        />
      </div>

      {/* Flechas (solo si hay más de una) */}
      {hasMultiple && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
            aria-label="Siguiente"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      {/* Caption (si tiene) */}
      {current.caption && (
        <div
          className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-t from-black/60 to-transparent text-white text-center text-sm"
          onClick={(e) => e.stopPropagation()}
        >
          {current.caption}
        </div>
      )}
    </div>,
    document.body
  );
}
