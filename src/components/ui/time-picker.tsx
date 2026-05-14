import { useRef, useEffect, useState } from "react";
import { Clock } from "lucide-react";
import {
  Dialog, DialogContent, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  value: string;          // formato "HH:MM"
  onChange: (val: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Selector de hora estilo iOS.
 * En PC se ve como un dropdown clásico con 2 wheels (hora + minuto).
 * En mobile usa la UI nativa de iOS/Android (`type="time"` con step).
 */
export function TimePicker({ value, onChange, label, required, disabled, className }: Props) {
  const [open, setOpen] = useState(false);
  const [tempH, setTempH] = useState("00");
  const [tempM, setTempM] = useState("00");

  // Detectar mobile
  const isMobile = typeof window !== "undefined" && /Mobi|Android|iPhone/i.test(navigator.userAgent);

  useEffect(() => {
    if (value) {
      const [h, m] = value.split(":");
      setTempH(h ?? "00");
      setTempM(m ?? "00");
    }
  }, [value, open]);

  // En mobile usamos el input nativo (la UI ya es buena)
  if (isMobile) {
    return (
      <div className={className}>
        {label && (
          <label className="block text-sm font-medium mb-1">
            {label} {required && <span className="text-destructive">*</span>}
          </label>
        )}
        <div className="relative">
          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="time"
            value={value}
            required={required}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-md border border-input bg-background text-sm"
          />
        </div>
      </div>
    );
  }

  // Desktop: dialog con wheels
  const handleConfirm = () => {
    onChange(`${tempH}:${tempM}`);
    setOpen(false);
  };

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium mb-1">
          {label} {required && <span className="text-destructive">*</span>}
        </label>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm text-left flex items-center gap-2 disabled:opacity-50 hover:border-primary/40 transition-colors"
      >
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className={value ? "" : "text-muted-foreground"}>
          {value || "Seleccionar hora"}
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xs sm:max-w-sm">
          <DialogTitle>Seleccionar hora</DialogTitle>
          <div className="flex items-center justify-center gap-2 my-4">
            <Wheel
              values={Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"))}
              value={tempH}
              onChange={setTempH}
              label="Hora"
            />
            <div className="text-3xl font-bold text-muted-foreground">:</div>
            <Wheel
              values={Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"))}
              value={tempM}
              onChange={setTempM}
              label="Min"
            />
          </div>
          <div className="text-center text-3xl font-bold py-2">
            {tempH}:{tempM}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleConfirm}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Wheel scrolleable estilo iOS */
function Wheel({ values, value, onChange, label }: {
  values: string[];
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const itemHeight = 40;

  // Scroll al valor seleccionado cuando se abre
  useEffect(() => {
    if (ref.current) {
      const idx = values.indexOf(value);
      if (idx >= 0) {
        ref.current.scrollTop = idx * itemHeight;
      }
    }
  }, [value, values]);

  // Detectar cuál es el item central cuando el usuario scrolea
  const handleScroll = () => {
    if (!ref.current) return;
    const idx = Math.round(ref.current.scrollTop / itemHeight);
    const clamped = Math.max(0, Math.min(values.length - 1, idx));
    if (values[clamped] !== value) {
      onChange(values[clamped]);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <span className="text-xs text-muted-foreground mb-1">{label}</span>
      <div className="relative w-20 h-[120px] overflow-hidden border rounded-lg bg-muted/30">
        {/* Highlight central */}
        <div
          className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-10 border-y-2 border-primary/40 pointer-events-none z-10 bg-primary/5"
        />
        <div
          ref={ref}
          onScroll={handleScroll}
          className="absolute inset-0 overflow-y-scroll scrollbar-hide snap-y snap-mandatory"
          style={{
            paddingTop: itemHeight,
            paddingBottom: itemHeight,
            scrollbarWidth: "none",
          }}
        >
          {values.map((v) => (
            <div
              key={v}
              onClick={() => {
                onChange(v);
                if (ref.current) {
                  ref.current.scrollTop = values.indexOf(v) * itemHeight;
                }
              }}
              className={`h-10 flex items-center justify-center text-lg snap-center cursor-pointer transition-all ${
                v === value ? "font-bold text-foreground" : "text-muted-foreground/60"
              }`}
            >
              {v}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
