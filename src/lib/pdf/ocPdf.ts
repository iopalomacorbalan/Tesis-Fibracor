import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  PDF_COLORS, PAGE,
  drawHeader, paginarTodo,
  sectionTitle, infoRow, ensureSpace,
  fmtMoney, fmtDate, fmtNumber,
} from "./helpers";
import type { CompraConRelaciones } from "@/types/database";

export interface PdfOcOptions {
  incluirPrecios: boolean;
  observacionesAdicionales?: string;
}

export async function generarPdfOc(args: {
  compra: CompraConRelaciones;
  options?: Partial<PdfOcOptions>;
}): Promise<jsPDF> {
  const opts: PdfOcOptions = {
    incluirPrecios: true,
    ...args.options,
  };
  const { compra } = args;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = await drawHeader(doc, "Orden de compra", compra.compra_id);

  // ====== INFO HEADER ======
  y = sectionTitle(doc, "Datos de la orden", y);

  const colWidth = (PAGE.width - PAGE.margin * 2) / 2;
  let yLeft = y;
  let yRight = y;

  // Columna izquierda - proveedor
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.text("PROVEEDOR", PAGE.margin, yLeft);
  yLeft += 4;
  doc.setFontSize(11);
  doc.setTextColor(...PDF_COLORS.text);
  doc.setFont("helvetica", "bold");
  doc.text(compra.proveedor?.nombre ?? "—", PAGE.margin, yLeft);
  yLeft += 5;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  if (compra.proveedor?.cuit) {
    doc.text(`CUIT: ${compra.proveedor.cuit}`, PAGE.margin, yLeft);
    yLeft += 4;
  }
  if (compra.proveedor?.contacto) {
    doc.text(`Contacto: ${compra.proveedor.contacto}`, PAGE.margin, yLeft);
    yLeft += 4;
  }
  if (compra.proveedor?.email) {
    doc.text(compra.proveedor.email, PAGE.margin, yLeft);
    yLeft += 4;
  }
  if (compra.proveedor?.telefono) {
    doc.text(compra.proveedor.telefono, PAGE.margin, yLeft);
    yLeft += 4;
  }

  // Columna derecha - datos OC
  yRight = infoRow(doc, "Fecha:", fmtDate(compra.fecha_solicitud), PAGE.margin + colWidth, yRight);
  yRight = infoRow(doc, "Estado:", compra.estado, PAGE.margin + colWidth, yRight);
  if (compra.fecha_aprobacion) {
    yRight = infoRow(doc, "Aprobada:", fmtDate(compra.fecha_aprobacion), PAGE.margin + colWidth, yRight);
  }
  if (compra.obra) {
    yRight = infoRow(doc, "Obra:", compra.obra.obra_id, PAGE.margin + colWidth, yRight);
    if (compra.obra.nombre_obra) {
      yRight = infoRow(doc, "Proyecto:", compra.obra.nombre_obra, PAGE.margin + colWidth, yRight);
    }
  }

  y = Math.max(yLeft, yRight) + 6;

  // ====== TABLA DE ÍTEMS ======
  y = ensureSpace(doc, y, 30);
  y = sectionTitle(doc, "Detalle de ítems", y);

  const items = compra.items ?? [];

  if (opts.incluirPrecios) {
    autoTable(doc, {
      startY: y,
      theme: "striped",
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: PDF_COLORS.primary, textColor: 255, fontStyle: "bold" },
      head: [["#", "Código", "Descripción", "Cant.", "Unid.", "Precio unit.", "Subtotal"]],
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        3: { halign: "right" },
        5: { halign: "right" },
        6: { halign: "right", fontStyle: "bold" },
      },
      body: items.map((it, idx) => [
        String(idx + 1),
        (it as any).item?.item_id ?? "—",
        it.descripcion,
        fmtNumber(it.cantidad_solicitada, 2),
        (it as any).item?.unidad ?? "ud.",
        fmtMoney(it.precio_unitario),
        fmtMoney(it.cantidad_solicitada * it.precio_unitario),
      ]),
      margin: { left: PAGE.margin, right: PAGE.margin },
    });
  } else {
    autoTable(doc, {
      startY: y,
      theme: "striped",
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: PDF_COLORS.primary, textColor: 255, fontStyle: "bold" },
      head: [["#", "Código", "Descripción", "Cantidad", "Unidad"]],
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        3: { halign: "right" },
      },
      body: items.map((it, idx) => [
        String(idx + 1),
        (it as any).item?.item_id ?? "—",
        it.descripcion,
        fmtNumber(it.cantidad_solicitada, 2),
        (it as any).item?.unidad ?? "ud.",
      ]),
      margin: { left: PAGE.margin, right: PAGE.margin },
    });
  }

  y = (doc as any).lastAutoTable.finalY + 4;

  // ====== TOTAL (si se incluyen precios) ======
  if (opts.incluirPrecios) {
    const totalItems = items.reduce((s, it) => s + it.cantidad_solicitada * it.precio_unitario, 0);

    y = ensureSpace(doc, y, 14);
    doc.setDrawColor(...PDF_COLORS.border);
    doc.setLineWidth(0.5);
    doc.line(PAGE.width - PAGE.margin - 80, y, PAGE.width - PAGE.margin, y);
    y += 5;

    doc.setFontSize(11);
    doc.setTextColor(...PDF_COLORS.text);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL ESTIMADO:", PAGE.width - PAGE.margin - 80, y);
    doc.setFontSize(13);
    doc.setTextColor(...PDF_COLORS.primary);
    doc.text(fmtMoney(totalItems), PAGE.width - PAGE.margin, y, { align: "right" });
    y += 8;
  }

  // ====== OBSERVACIONES ======
  if (compra.observaciones || opts.observacionesAdicionales) {
    y = ensureSpace(doc, y, 16);
    y += 3;
    y = sectionTitle(doc, "Observaciones", y);
    doc.setFontSize(9);
    doc.setTextColor(...PDF_COLORS.text);
    doc.setFont("helvetica", "normal");
    const texto = [compra.observaciones, opts.observacionesAdicionales].filter(Boolean).join("\n\n");
    const wrapped = doc.splitTextToSize(texto, PAGE.width - PAGE.margin * 2);
    doc.text(wrapped, PAGE.margin, y);
    y += wrapped.length * 4.5 + 4;
  }

  // ====== CONDICIONES (genéricas) ======
  y = ensureSpace(doc, y, 25);
  y += 3;
  y = sectionTitle(doc, "Condiciones generales", y);
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.setFont("helvetica", "normal");
  const condiciones = [
    "• La presente orden de compra debe ser aceptada por el proveedor antes de proceder con la entrega.",
    "• Los precios cotizados son válidos por 30 días corridos desde la fecha de emisión.",
    "• La factura debe hacer referencia al número de orden de compra para su correcta liquidación.",
    "• Cualquier modificación debe ser informada por escrito y autorizada por FIBRACOR.",
  ];
  for (const c of condiciones) {
    y = ensureSpace(doc, y, 6);
    const wrapped = doc.splitTextToSize(c, PAGE.width - PAGE.margin * 2);
    doc.text(wrapped, PAGE.margin, y);
    y += wrapped.length * 4 + 1;
  }

  paginarTodo(doc);
  return doc;
}
