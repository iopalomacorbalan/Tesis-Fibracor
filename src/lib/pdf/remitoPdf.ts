import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  PDF_COLORS, PAGE,
  drawHeader, paginarTodo,
  sectionTitle, infoRow, ensureSpace,
  fmtDate, fmtNumber,
} from "./helpers";
import type { RemitoConRelaciones } from "@/types/database";

export interface PdfRemitoOptions {
  paraFirmar: boolean; // si true, omite los datos del receptor (queda en blanco para firmar)
}

export async function generarPdfRemito(args: {
  remito: RemitoConRelaciones;
  options?: Partial<PdfRemitoOptions>;
}): Promise<jsPDF> {
  const opts: PdfRemitoOptions = {
    paraFirmar: false,
    ...args.options,
  };
  const { remito } = args;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = await drawHeader(doc, "REMITO", remito.remito_id);

  // ====== INFO HEADER ======
  y = sectionTitle(doc, "Datos de la entrega", y);

  const colWidth = (PAGE.width - PAGE.margin * 2) / 2;
  let yLeft = y;
  let yRight = y;

  // Cliente
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.text("CLIENTE", PAGE.margin, yLeft);
  yLeft += 4;
  doc.setFontSize(11);
  doc.setTextColor(...PDF_COLORS.text);
  doc.setFont("helvetica", "bold");
  doc.text(remito.cliente?.nombre ?? "—", PAGE.margin, yLeft);
  yLeft += 5;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  if (remito.cliente?.cuit) {
    doc.text(`CUIT: ${remito.cliente.cuit}`, PAGE.margin, yLeft);
    yLeft += 4;
  }
  if (remito.cliente?.direccion) {
    const wrapped = doc.splitTextToSize(remito.cliente.direccion, colWidth - 5);
    doc.text(wrapped, PAGE.margin, yLeft);
    yLeft += wrapped.length * 4;
  }
  if (remito.cliente?.contacto) {
    doc.text(`Atn: ${remito.cliente.contacto}`, PAGE.margin, yLeft);
    yLeft += 4;
  }

  // Datos del remito
  yRight = infoRow(doc, "Fecha:", fmtDate(remito.fecha), PAGE.margin + colWidth, yRight);
  if (remito.obra) {
    yRight = infoRow(doc, "Obra:", remito.obra.obra_id, PAGE.margin + colWidth, yRight);
    if (remito.obra.nombre_obra) {
      yRight = infoRow(doc, "Proyecto:", remito.obra.nombre_obra, PAGE.margin + colWidth, yRight);
    }
    if (remito.obra.sitio) {
      yRight = infoRow(doc, "Sitio:", remito.obra.sitio, PAGE.margin + colWidth, yRight);
    }
  }

  y = Math.max(yLeft, yRight) + 6;

  // ====== TABLA DE ÍTEMS ======
  y = ensureSpace(doc, y, 30);
  y = sectionTitle(doc, "Detalle de ítems entregados", y);

  const items = remito.items ?? [];

  autoTable(doc, {
    startY: y,
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: PDF_COLORS.primary, textColor: 255, fontStyle: "bold" },
    head: [["#", "Código", "Descripción", "Cant.", "Unid.", "Observaciones"]],
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 22 },
      3: { cellWidth: 18, halign: "right" },
      4: { cellWidth: 14, halign: "center" },
    },
    body: items.map((it, idx) => [
      String(idx + 1),
      (it as any).item?.item_id ?? "—",
      (it as any).item?.descripcion ?? it.descripcion_libre ?? "—",
      fmtNumber(it.cantidad, 2),
      (it as any).item?.unidad ?? it.unidad ?? "ud.",
      it.observaciones ?? "",
    ]),
    margin: { left: PAGE.margin, right: PAGE.margin },
  });

  y = (doc as any).lastAutoTable.finalY + 4;

  // Total de ítems
  const totalUnidades = items.reduce((s, it) => s + Number(it.cantidad), 0);
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.setFont("helvetica", "italic");
  doc.text(
    `Total: ${items.length} ítem${items.length !== 1 ? "s" : ""} · ${fmtNumber(totalUnidades, 2)} unidades`,
    PAGE.margin, y
  );
  y += 6;

  // ====== OBSERVACIONES ======
  if (remito.observaciones) {
    y = ensureSpace(doc, y, 16);
    y = sectionTitle(doc, "Observaciones", y);
    doc.setFontSize(9);
    doc.setTextColor(...PDF_COLORS.text);
    doc.setFont("helvetica", "normal");
    const wrapped = doc.splitTextToSize(remito.observaciones, PAGE.width - PAGE.margin * 2);
    doc.text(wrapped, PAGE.margin, y);
    y += wrapped.length * 4.5 + 4;
  }

  // ====== SECCIÓN DE FIRMAS ======
  y = ensureSpace(doc, y, 50);
  y += 6;

  doc.setDrawColor(...PDF_COLORS.border);
  doc.setLineWidth(0.3);
  doc.line(PAGE.margin, y, PAGE.width - PAGE.margin, y);
  y += 8;

  // Box "Entrega" - izquierda
  const halfW = (PAGE.width - PAGE.margin * 2 - 10) / 2;
  const boxLeftX = PAGE.margin;
  const boxRightX = PAGE.margin + halfW + 10;

  // Línea de firma izquierda
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.text("ENTREGA", boxLeftX, y);
  doc.line(boxLeftX, y + 18, boxLeftX + halfW, y + 18);
  doc.setFontSize(8);
  doc.text("Firma y aclaración", boxLeftX + halfW / 2, y + 22, { align: "center" });
  doc.text("FIBRACOR", boxLeftX + halfW / 2, y + 26, { align: "center" });

  // Línea de firma derecha (RECIBE)
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.text("RECIBE", boxRightX, y);
  doc.line(boxRightX, y + 18, boxRightX + halfW, y + 18);
  doc.setFontSize(8);
  doc.text("Firma y aclaración", boxRightX + halfW / 2, y + 22, { align: "center" });

  if (!opts.paraFirmar) {
    // Versión final - mostrar datos del receptor + firma dibujada si existe
    if (remito.firma_imagen) {
      // Firma dibujada: la dibujamos dentro del recuadro derecho, arriba de la línea
      try {
        // El recuadro tiene halfW de ancho. Margen 5mm a cada lado → firma de halfW-10
        const firmaW = halfW - 10;
        const firmaH = 14; // alto del bloque de firma
        const firmaX = boxRightX + 5;
        const firmaY = y + 2;

        // Calcular dimensiones reales para no deformar
        let drawW = firmaW;
        let drawH = firmaH;
        let offsetX = 0;
        try {
          const props = doc.getImageProperties(remito.firma_imagen);
          const ratio = props.width / props.height;
          const boxRatio = firmaW / firmaH;
          if (ratio > boxRatio) {
            drawW = firmaW;
            drawH = firmaW / ratio;
          } else {
            drawH = firmaH;
            drawW = firmaH * ratio;
            offsetX = (firmaW - drawW) / 2;
          }
        } catch { /* usar defaults */ }

        doc.addImage(
          remito.firma_imagen, "PNG",
          firmaX + offsetX, firmaY,
          drawW, drawH,
        );
      } catch (e) {
        // Si falla, mostrar texto indicador
        doc.setFontSize(7);
        doc.setTextColor(...PDF_COLORS.muted);
        doc.text("(firma no disponible)", boxRightX + halfW / 2, y + 10, { align: "center" });
      }
    }

    if (remito.recibido_por) {
      doc.setFontSize(10);
      doc.setTextColor(...PDF_COLORS.text);
      doc.setFont("helvetica", "bold");
      doc.text(remito.recibido_por, boxRightX + halfW / 2, y + 22, { align: "center" });
    }
    if (remito.dni_receptor) {
      doc.setFontSize(8);
      doc.setTextColor(...PDF_COLORS.muted);
      doc.setFont("helvetica", "normal");
      doc.text(`DNI: ${remito.dni_receptor}`, boxRightX + halfW / 2, y + 27, { align: "center" });
    }
    if (remito.fecha_recepcion) {
      doc.setFontSize(8);
      doc.setTextColor(...PDF_COLORS.muted);
      doc.text(`Fecha: ${fmtDate(remito.fecha_recepcion)}`, boxRightX + halfW / 2, y + 31, { align: "center" });
    }
    // Sello "FIRMADO DIGITALMENTE"
    if (remito.firma_estado === "firmado" || remito.firma_imagen) {
      doc.setFontSize(7);
      doc.setTextColor(...PDF_COLORS.success);
      doc.setFont("helvetica", "bold");
      doc.text("✓ FIRMADO DIGITALMENTE", boxRightX + halfW / 2, y + 36, { align: "center" });
    }
  } else {
    // Versión para firmar - dejar campos en blanco con guías
    doc.setFontSize(7);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text("DNI: _____________________", boxRightX + halfW / 2, y + 30, { align: "center" });
    doc.text("Fecha: ___ / ___ / ______", boxRightX + halfW / 2, y + 34, { align: "center" });
  }

  // Marca de versión "Para firmar"
  if (opts.paraFirmar) {
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.warning);
    doc.setFont("helvetica", "bold");
    doc.text("VERSIÓN PARA FIRMAR", PAGE.width / 2, PAGE.height - 16, { align: "center" });
  }

  paginarTodo(doc);
  return doc;
}
