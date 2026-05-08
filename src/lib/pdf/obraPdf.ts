import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  PDF_COLORS, PAGE, COMPANY,
  drawHeader, drawFooter, paginarTodo,
  sectionTitle, infoRow, ensureSpace,
  urlToDataUrl, detectImageFormat,
  fmtMoney, fmtDate, fmtNumber, diasEntre,
} from "./helpers";
import type { ObraConRelaciones, ReporteConRelaciones } from "@/types/database";
import type { ObraCostos } from "@/modules/obras/useObraCostos";

export interface PdfObraOptions {
  // Qué incluir
  incluirReportes: boolean;
  incluirFotos: boolean;
  incluirFinanciero: boolean;
  incluirMaterialesDetalle: boolean;
  // Calidad de imagen (mm máximo)
  fotoMaxAncho?: number;
  fotoMaxAlto?: number;
  // Si no se quiere mostrar precio costo (interno) en el resumen financiero
  mostrarSoloLista?: boolean;
}

const DEFAULTS: PdfObraOptions = {
  incluirReportes: true,
  incluirFotos: true,
  incluirFinanciero: false,
  incluirMaterialesDetalle: false,
  fotoMaxAncho: 75,
  fotoMaxAlto: 55,
  mostrarSoloLista: false,
};

export async function generarPdfObra(args: {
  obra: ObraConRelaciones;
  reportes: ReporteConRelaciones[];
  costos?: ObraCostos | null;
  options?: Partial<PdfObraOptions>;
}): Promise<jsPDF> {
  const opts: PdfObraOptions = { ...DEFAULTS, ...args.options };
  const { obra, reportes, costos } = args;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = await drawHeader(doc, "Resumen de obra", obra.obra_id);

  // ====== INFO DE LA OBRA ======
  y = sectionTitle(doc, "Datos del proyecto", y);

  const colWidth = (PAGE.width - PAGE.margin * 2) / 2;
  let yLeft = y;
  let yRight = y;
  yLeft = infoRow(doc, "Cliente:", obra.cliente?.nombre ?? "—", PAGE.margin, yLeft);
  yLeft = infoRow(doc, "Obra:", obra.nombre_obra ?? obra.obra_id, PAGE.margin, yLeft);
  if (obra.sitio) yLeft = infoRow(doc, "Sitio:", obra.sitio, PAGE.margin, yLeft);
  if (obra.jefe_obra) yLeft = infoRow(doc, "Jefe obra:", obra.jefe_obra.nombre, PAGE.margin, yLeft);

  yRight = infoRow(doc, "Estado:", obra.estado, PAGE.margin + colWidth, yRight);
  yRight = infoRow(doc, "Inicio:", fmtDate(obra.fecha_inicio_real || obra.fecha_inicio_est), PAGE.margin + colWidth, yRight);
  yRight = infoRow(doc, "Fin:", fmtDate(obra.fecha_fin_real || obra.fecha_fin_est), PAGE.margin + colWidth, yRight);
  if (obra.fecha_inicio_real && obra.fecha_fin_real) {
    yRight = infoRow(doc, "Duración:", `${diasEntre(obra.fecha_inicio_real, obra.fecha_fin_real)} días`, PAGE.margin + colWidth, yRight);
  } else if (obra.fecha_inicio_est && obra.fecha_fin_est) {
    yRight = infoRow(doc, "Duración est.:", `${diasEntre(obra.fecha_inicio_est, obra.fecha_fin_est)} días`, PAGE.margin + colWidth, yRight);
  }

  y = Math.max(yLeft, yRight) + 4;

  // Técnicos asignados
  if (obra.tecnicos && obra.tecnicos.length > 0) {
    y = ensureSpace(doc, y, 14);
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.setFont("helvetica", "normal");
    doc.text("Técnicos asignados:", PAGE.margin, y);
    doc.setFontSize(10);
    doc.setTextColor(...PDF_COLORS.text);
    doc.setFont("helvetica", "bold");
    const nombres = obra.tecnicos.map((t: any) => t.nombre).join(", ");
    const wrapped = doc.splitTextToSize(nombres, PAGE.width - PAGE.margin * 2 - 35);
    doc.text(wrapped, PAGE.margin + 35, y);
    y += wrapped.length * 5 + 2;
  }

  // Alcance técnico
  if (obra.alcance_tecnico) {
    y = ensureSpace(doc, y, 16);
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.setFont("helvetica", "normal");
    doc.text("Alcance técnico:", PAGE.margin, y);
    y += 5;
    doc.setFontSize(9);
    doc.setTextColor(...PDF_COLORS.text);
    doc.setFont("helvetica", "normal");
    const wrapped = doc.splitTextToSize(obra.alcance_tecnico, PAGE.width - PAGE.margin * 2);
    doc.text(wrapped, PAGE.margin, y);
    y += wrapped.length * 4.5 + 4;
  }

  // ====== REPORTES ======
  if (opts.incluirReportes && reportes.length > 0) {
    y = ensureSpace(doc, y, 20);
    y += 4;
    y = sectionTitle(doc, `Reportes de obra (${reportes.length})`, y);

    for (const rep of reportes) {
      y = ensureSpace(doc, y, 30);

      // Mini header del reporte
      doc.setFillColor(...PDF_COLORS.bg_light);
      doc.rect(PAGE.margin, y, PAGE.width - PAGE.margin * 2, 7, "F");
      doc.setFontSize(9);
      doc.setTextColor(...PDF_COLORS.text);
      doc.setFont("helvetica", "bold");
      doc.text(`${rep.reporte_id} · ${fmtDate(rep.fecha)}`, PAGE.margin + 2, y + 5);
      if (rep.tecnico) {
        doc.setTextColor(...PDF_COLORS.muted);
        doc.setFont("helvetica", "normal");
        doc.text(rep.tecnico.nombre, PAGE.width - PAGE.margin - 2, y + 5, { align: "right" });
      }
      y += 9;

      doc.setTextColor(...PDF_COLORS.text);

      if (rep.descripcion) {
        doc.setFontSize(8);
        doc.setTextColor(...PDF_COLORS.muted);
        doc.setFont("helvetica", "normal");
        doc.text("Descripción:", PAGE.margin, y);
        y += 4;
        doc.setFontSize(9);
        doc.setTextColor(...PDF_COLORS.text);
        const wrapped = doc.splitTextToSize(rep.descripcion, PAGE.width - PAGE.margin * 2);
        y = ensureSpace(doc, y, wrapped.length * 4 + 2);
        doc.text(wrapped, PAGE.margin, y);
        y += wrapped.length * 4 + 2;
      }

      if (rep.trabajos_realizados) {
        y = ensureSpace(doc, y, 10);
        doc.setFontSize(8);
        doc.setTextColor(...PDF_COLORS.muted);
        doc.text("Trabajos realizados:", PAGE.margin, y);
        y += 4;
        doc.setFontSize(9);
        doc.setTextColor(...PDF_COLORS.text);
        const wrapped = doc.splitTextToSize(rep.trabajos_realizados, PAGE.width - PAGE.margin * 2);
        y = ensureSpace(doc, y, wrapped.length * 4 + 2);
        doc.text(wrapped, PAGE.margin, y);
        y += wrapped.length * 4 + 2;
      }

      if (rep.pendientes) {
        y = ensureSpace(doc, y, 10);
        doc.setFontSize(8);
        doc.setTextColor(...PDF_COLORS.muted);
        doc.text("Pendientes:", PAGE.margin, y);
        y += 4;
        doc.setFontSize(9);
        doc.setTextColor(...PDF_COLORS.text);
        const wrapped = doc.splitTextToSize(rep.pendientes, PAGE.width - PAGE.margin * 2);
        y = ensureSpace(doc, y, wrapped.length * 4 + 2);
        doc.text(wrapped, PAGE.margin, y);
        y += wrapped.length * 4 + 2;
      }

      // Fotos del reporte
      if (opts.incluirFotos && rep.fotos && rep.fotos.length > 0) {
        const fotosUrls = rep.fotos
          .filter(f => f.url)
          .map(f => f.url as string);

        const dataUrls = await Promise.all(fotosUrls.map(u => urlToDataUrl(u)));
        const validFotos = dataUrls.filter((d): d is string => !!d);

        if (validFotos.length > 0) {
          y = ensureSpace(doc, y, 5);
          doc.setFontSize(8);
          doc.setTextColor(...PDF_COLORS.muted);
          doc.text(`Fotos (${validFotos.length}):`, PAGE.margin, y);
          y += 4;

          // Grid: hasta 2 por fila, 75x55mm cada una
          const fotoW = opts.fotoMaxAncho!;
          const fotoH = opts.fotoMaxAlto!;
          const gap = 5;
          const fotosPorFila = 2;

          for (let i = 0; i < validFotos.length; i += fotosPorFila) {
            y = ensureSpace(doc, y, fotoH + 4);
            for (let j = 0; j < fotosPorFila && i + j < validFotos.length; j++) {
              const x = PAGE.margin + j * (fotoW + gap);
              const fmt = detectImageFormat(validFotos[i + j]);
              try {
                doc.addImage(validFotos[i + j], fmt, x, y, fotoW, fotoH);
              } catch (e) {
                // Si falla la foto, dibujar un placeholder
                doc.setFillColor(...PDF_COLORS.bg_light);
                doc.rect(x, y, fotoW, fotoH, "F");
                doc.setFontSize(7);
                doc.setTextColor(...PDF_COLORS.muted);
                doc.text("(foto no disponible)", x + fotoW / 2, y + fotoH / 2, { align: "center" });
              }
            }
            y += fotoH + 4;
          }
        }
      }

      // Separador entre reportes
      y += 3;
      doc.setDrawColor(...PDF_COLORS.border);
      doc.setLineWidth(0.2);
      doc.line(PAGE.margin, y, PAGE.width - PAGE.margin, y);
      y += 4;
    }
  }

  // ====== RESUMEN FINANCIERO ======
  if (opts.incluirFinanciero && costos) {
    doc.addPage();
    y = PAGE.margin + 5;
    y = sectionTitle(doc, "Resumen financiero", y);

    // Tabla de KPIs principales
    autoTable(doc, {
      startY: y,
      theme: "plain",
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: PDF_COLORS.primary, textColor: 255, fontStyle: "bold" },
      head: [["Concepto", "A precio costo", "A precio lista"]],
      body: [
        ["Presupuesto de obra", fmtMoney(costos.presupuesto), fmtMoney(costos.presupuesto)],
        ["Materiales consumidos", fmtMoney(costos.total_materiales_costo), fmtMoney(costos.total_materiales_lista)],
        ["Compras vinculadas (OCs)", fmtMoney(costos.total_ocs), fmtMoney(costos.total_ocs)],
        [
          { content: "Total ejecutado", styles: { fontStyle: "bold" } },
          { content: fmtMoney(costos.total_ejecutado_costo), styles: { fontStyle: "bold" } },
          { content: fmtMoney(costos.total_ejecutado_lista), styles: { fontStyle: "bold" } },
        ],
        [
          { content: "Margen estimado", styles: { fontStyle: "bold", textColor: PDF_COLORS.primary } },
          {
            content: `${fmtMoney(costos.margen_costo)} (${fmtNumber(costos.margen_costo_pct, 1)}%)`,
            styles: {
              fontStyle: "bold",
              textColor: costos.margen_costo >= 0 ? PDF_COLORS.success : PDF_COLORS.danger,
            },
          },
          {
            content: `${fmtMoney(costos.margen_lista)} (${fmtNumber(costos.margen_lista_pct, 1)}%)`,
            styles: {
              fontStyle: "bold",
              textColor: costos.margen_lista >= 0 ? PDF_COLORS.success : PDF_COLORS.danger,
            },
          },
        ],
      ],
      margin: { left: PAGE.margin, right: PAGE.margin },
    });

    y = (doc as any).lastAutoTable.finalY + 8;

    // Detalle de materiales
    if (opts.incluirMaterialesDetalle && costos.materiales.length > 0) {
      y = ensureSpace(doc, y, 30);
      y = sectionTitle(doc, "Materiales consumidos", y);

      autoTable(doc, {
        startY: y,
        theme: "striped",
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: PDF_COLORS.primary, textColor: 255, fontStyle: "bold" },
        head: [["Código", "Descripción", "Cant.", "Unidad", "Costo unit.", "Lista unit.", "Total costo", "Total lista"]],
        body: costos.materiales.map(m => [
          m.item_codigo,
          m.descripcion,
          fmtNumber(m.cantidad_total, 2),
          m.unidad,
          fmtMoney(m.precio_costo),
          fmtMoney(m.precio_lista),
          fmtMoney(m.total_costo),
          fmtMoney(m.total_lista),
        ]),
        margin: { left: PAGE.margin, right: PAGE.margin },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // OCs vinculadas
    if (costos.ocs.length > 0) {
      y = ensureSpace(doc, y, 30);
      y = sectionTitle(doc, "Órdenes de compra vinculadas", y);

      autoTable(doc, {
        startY: y,
        theme: "striped",
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: PDF_COLORS.primary, textColor: 255, fontStyle: "bold" },
        head: [["OC", "Proveedor", "Fecha", "Estado", "Total"]],
        body: costos.ocs.map(c => [
          c.compra_id,
          c.proveedor_nombre ?? "—",
          fmtDate(c.fecha_solicitud),
          c.estado,
          fmtMoney(c.total_estimado),
        ]),
        margin: { left: PAGE.margin, right: PAGE.margin },
      });
    }
  }

  // Footer en todas las páginas
  paginarTodo(doc);

  return doc;
}
