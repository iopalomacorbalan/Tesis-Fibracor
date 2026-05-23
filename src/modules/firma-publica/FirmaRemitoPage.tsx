import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";

interface ItemFirma {
  id: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
}

interface RemitoFirma {
  remito_id: string;
  fecha: string;
  cliente: string;
  obra: string;
  estado: string;
  firma_nombre?: string;
  firma_fecha?: string;
  items: ItemFirma[];
  error?: string;
}

export default function FirmaRemitoPage() {
  const { token } = useParams<{ token: string }>();
  const [remito, setRemito] = useState<RemitoFirma | null>(null);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState(false);

  const [nombre, setNombre] = useState("");
  const [dni, setDni] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [itemsRecibidos, setItemsRecibidos] = useState<Record<string, boolean>>({});

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const firmaVacia = useRef(true);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("get_remito_para_firma", { p_token: token });
        if (error) throw error;
        const r = data as RemitoFirma;
        setRemito(r);
        // Por defecto todos los items tildados
        if (r.items) {
          const init: Record<string, boolean> = {};
          r.items.forEach(it => { init[it.id] = true; });
          setItemsRecibidos(init);
        }
      } catch (e) {
        setRemito({ error: "No se pudo cargar el remito" } as RemitoFirma);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  // ===== Canvas de firma =====
  const getCtx = () => canvasRef.current?.getContext("2d");

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#111";
    }
  }, []);

  useEffect(() => {
    if (!loading && remito && !remito.error) {
      setTimeout(setupCanvas, 100);
    }
  }, [loading, remito, setupCanvas]);

  const posXY = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.PointerEvent) => {
    e.preventDefault();
    dibujando.current = true;
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = posXY(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.PointerEvent) => {
    if (!dibujando.current) return;
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = posXY(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    firmaVacia.current = false;
  };

  const endDraw = () => { dibujando.current = false; };

  const limpiarFirma = () => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      firmaVacia.current = true;
    }
  };

  const handleEnviar = async () => {
    if (!nombre.trim()) { alert("Ingresá nombre y apellido"); return; }
    if (!dni.trim()) { alert("Ingresá el DNI"); return; }
    if (firmaVacia.current) { alert("Por favor, firmá en el recuadro"); return; }

    const firmaImagen = canvasRef.current?.toDataURL("image/png") ?? "";

    setEnviando(true);
    try {
      const { data, error } = await supabase.rpc("firmar_remito", {
        p_token: token,
        p_nombre: nombre,
        p_dni: dni,
        p_firma_imagen: firmaImagen,
        p_items_recibidos: itemsRecibidos,
        p_observaciones: observaciones || null,
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setExito(true);
    } catch (e: any) {
      alert("Error al firmar: " + e.message);
    } finally {
      setEnviando(false);
    }
  };

  // ===== Render =====
  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={{ textAlign: "center", padding: 40 }}>Cargando...</div>
      </div>
    );
  }

  if (!remito || remito.error) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ padding: 40, textAlign: "center", color: "#b91c1c" }}>
            ❌ {remito?.error ?? "Remito no encontrado"}
          </div>
        </div>
      </div>
    );
  }

  if (exito || remito.estado === "firmado") {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={headerStyle}>
            <div style={{ fontSize: 20, fontWeight: 600 }}>FIBRACOR</div>
          </div>
          <div style={{ padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Remito firmado</h2>
            <p style={{ color: "#666", fontSize: 14, margin: 0 }}>
              {remito.remito_id} fue confirmado correctamente.
            </p>
            {(exito ? nombre : remito.firma_nombre) && (
              <p style={{ color: "#666", fontSize: 13, marginTop: 8 }}>
                Recibido por: <b>{exito ? nombre : remito.firma_nombre}</b>
              </p>
            )}
            <p style={{ color: "#999", fontSize: 12, marginTop: 16 }}>
              Ya podés cerrar esta página.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={headerStyle}>
          <div style={{ fontSize: 20, fontWeight: 600 }}>FIBRACOR</div>
          <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>Confirmación de recepción</div>
        </div>

        <div style={{ padding: 16 }}>
          <div style={infoBoxStyle}>
            <div style={{ color: "#555" }}>Remito <b style={{ color: "#111" }}>{remito.remito_id}</b></div>
            <div style={{ color: "#555", marginTop: 2 }}>Cliente: <b style={{ color: "#111" }}>{remito.cliente}</b></div>
            {remito.obra !== "—" && <div style={{ color: "#555", marginTop: 2 }}>Obra: <b style={{ color: "#111" }}>{remito.obra}</b></div>}
          </div>

          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            Items entregados — tildá los que recibís:
          </div>
          <div style={{ border: "1px solid #e5e5e5", borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
            {remito.items.map((it, idx) => (
              <label
                key={it.id}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                  fontSize: 14, borderBottom: idx < remito.items.length - 1 ? "1px solid #f0f0f0" : "none",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={itemsRecibidos[it.id] ?? false}
                  onChange={(e) => setItemsRecibidos(prev => ({ ...prev, [it.id]: e.target.checked }))}
                  style={{ width: 18, height: 18, flexShrink: 0 }}
                />
                <span style={{ flex: 1 }}>{it.descripcion}</span>
                <span style={{ color: "#888" }}>{it.cantidad} {it.unidad}</span>
              </label>
            ))}
          </div>

          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Datos de quien recibe:</div>
          <input
            placeholder="Nombre y apellido"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="DNI"
            value={dni}
            onChange={(e) => setDni(e.target.value)}
            inputMode="numeric"
            style={inputStyle}
          />
          <textarea
            placeholder="Observaciones (opcional) — ej: faltó un item, llegó dañado..."
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            rows={2}
            style={{ ...inputStyle, resize: "vertical" }}
          />

          <div style={{ fontSize: 13, fontWeight: 600, margin: "12px 0 6px", display: "flex", justifyContent: "space-between" }}>
            <span>Firma:</span>
            <button onClick={limpiarFirma} style={{ background: "none", border: "none", color: "#185FA5", fontSize: 12, cursor: "pointer" }}>
              Limpiar
            </button>
          </div>
          <canvas
            ref={canvasRef}
            onPointerDown={startDraw}
            onPointerMove={draw}
            onPointerUp={endDraw}
            onPointerLeave={endDraw}
            style={{
              width: "100%", height: 140, border: "1px dashed #bbb",
              borderRadius: 8, touchAction: "none", background: "#fafafa",
              marginBottom: 16, display: "block",
            }}
          />

          <button
            onClick={handleEnviar}
            disabled={enviando}
            style={{
              width: "100%", padding: 14, background: enviando ? "#9ca3af" : "#1D9E75",
              color: "white", border: "none", borderRadius: 8, fontSize: 15,
              fontWeight: 600, cursor: enviando ? "default" : "pointer",
            }}
          >
            {enviando ? "Enviando..." : "Confirmar recepción"}
          </button>
        </div>
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh", background: "#f3f4f6", padding: "16px",
  display: "flex", justifyContent: "center", alignItems: "flex-start",
  fontFamily: "system-ui, -apple-system, sans-serif",
};
const cardStyle: React.CSSProperties = {
  background: "white", borderRadius: 12, overflow: "hidden",
  width: "100%", maxWidth: 440, boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
};
const headerStyle: React.CSSProperties = {
  background: "#185FA5", padding: 16, textAlign: "center", color: "white",
};
const infoBoxStyle: React.CSSProperties = {
  background: "#f8f9fa", borderRadius: 8, padding: "10px 12px",
  marginBottom: 16, fontSize: 13,
};
const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: 10,
  border: "1px solid #ddd", borderRadius: 8, marginBottom: 8, fontSize: 14,
};
