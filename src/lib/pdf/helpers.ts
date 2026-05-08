import jsPDF from "jspdf";

// ============ CONSTANTES DE DISEÑO ============
export const PDF_COLORS = {
  primary: [37, 99, 235] as [number, number, number],     // azul
  text: [15, 23, 42] as [number, number, number],         // slate-900
  muted: [100, 116, 139] as [number, number, number],     // slate-500
  border: [226, 232, 240] as [number, number, number],    // slate-200
  bg_light: [248, 250, 252] as [number, number, number],  // slate-50
  success: [22, 163, 74] as [number, number, number],     // green-600
  danger: [220, 38, 38] as [number, number, number],      // red-600
  warning: [217, 119, 6] as [number, number, number],     // amber-600
};

export const COMPANY = {
  name: "FIBRACOR",
  tagline: "Soluciones en redes de datos y fibra óptica",
  // Datos editables más adelante (CUIT, dirección, etc.)
  cuit: "",
  direccion: "",
  email: "info@fibracor.com",
  telefono: "",
};

export const PAGE = {
  width: 210,    // A4 mm
  height: 297,
  margin: 15,
};

// ============ FORMATTERS ============
export function fmtMoney(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency", currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n ?? 0);
}

export function fmtNumber(n: number, decimals = 2): string {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(n ?? 0);
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

export function diasEntre(d1: string | null, d2: string | null): number {
  if (!d1 || !d2) return 0;
  const t1 = new Date(d1).getTime();
  const t2 = new Date(d2).getTime();
  return Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
}

// ============ HEADER ============
// Logo embebido como dataURL para que jsPDF lo renderice sin requests
let LOGO_DATA_URL: string | null = null;
async function getLogoDataUrl(): Promise<string | null> {
  if (LOGO_DATA_URL) return LOGO_DATA_URL;
  try {
    const res = await fetch("/logo-fibracor.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    LOGO_DATA_URL = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return LOGO_DATA_URL;
  } catch {
    return null;
  }
}

export async function drawHeader(doc: jsPDF, title: string, subtitle?: string): Promise<number> {
  // Intentar logo PNG
  const logoData = await getLogoDataUrl();
  if (logoData) {
    // Logo: 30mm de ancho, mantiene proporciones (PNG 600x300 = 2:1)
    doc.addImage(logoData, "PNG", PAGE.margin, 12, 30, 15);
  } else {
    // Fallback al "logo" textual
    doc.setFillColor(...PDF_COLORS.primary);
    doc.roundedRect(PAGE.margin, 12, 12, 12, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("F", PAGE.margin + 6, 21, { align: "center" });
    doc.setTextColor(...PDF_COLORS.text);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(COMPANY.name, PAGE.margin + 16, 19);
  }

  // Tagline debajo del logo
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF_COLORS.muted);
  doc.text(COMPANY.tagline, PAGE.margin, 31);

  // Título a la derecha
  doc.setTextColor(...PDF_COLORS.primary);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(title, PAGE.width - PAGE.margin, 19, { align: "right" });
  if (subtitle) {
    doc.setTextColor(...PDF_COLORS.muted);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(subtitle, PAGE.width - PAGE.margin, 24, { align: "right" });
  }

  // Línea divisoria
  doc.setDrawColor(...PDF_COLORS.border);
  doc.setLineWidth(0.5);
  doc.line(PAGE.margin, 35, PAGE.width - PAGE.margin, 35);

  return 41; // Y siguiente
}

// ============ FOOTER ============
export function drawFooter(doc: jsPDF, paginaActual?: number, totalPaginas?: number) {
  const y = PAGE.height - 10;
  doc.setDrawColor(...PDF_COLORS.border);
  doc.setLineWidth(0.3);
  doc.line(PAGE.margin, y - 4, PAGE.width - PAGE.margin, y - 4);
  doc.setFontSize(7);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.setFont("helvetica", "normal");
  doc.text(
    `${COMPANY.name} · ${COMPANY.email} · Generado el ${fmtDate(new Date())}`,
    PAGE.margin, y
  );
  if (paginaActual && totalPaginas) {
    doc.text(`Página ${paginaActual} de ${totalPaginas}`, PAGE.width - PAGE.margin, y, { align: "right" });
  }
}

// Llamar al final para enumerar todas las páginas
export function paginarTodo(doc: jsPDF) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    drawFooter(doc, i, total);
  }
}

// ============ HELPERS DE LAYOUT ============
export function sectionTitle(doc: jsPDF, text: string, y: number): number {
  doc.setFillColor(...PDF_COLORS.primary);
  doc.rect(PAGE.margin, y, 3, 6, "F");
  doc.setTextColor(...PDF_COLORS.text);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(text, PAGE.margin + 6, y + 5);
  return y + 10;
}

export function infoRow(doc: jsPDF, label: string, value: string, x: number, y: number, labelWidth = 35): number {
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.setFont("helvetica", "normal");
  doc.text(label, x, y);
  doc.setFontSize(10);
  doc.setTextColor(...PDF_COLORS.text);
  doc.setFont("helvetica", "bold");
  doc.text(value || "—", x + labelWidth, y);
  return y + 6;
}

// Fuerza salto de página si no entra
export function ensureSpace(doc: jsPDF, y: number, neededMm: number): number {
  if (y + neededMm > PAGE.height - 18) {
    doc.addPage();
    return PAGE.margin + 5;
  }
  return y;
}

// Carga imagen base64 desde URL pública (con CORS-bypass via proxy si falla)
export async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn("No se pudo cargar imagen", url, e);
    return null;
  }
}

export function detectImageFormat(dataUrl: string): "PNG" | "JPEG" {
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  return "JPEG";
}
