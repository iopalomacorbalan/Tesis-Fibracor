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
  incluirHerramientas: boolean;
  incluirCostosExtras: boolean;
  incluirHorasTecnicas: boolean;
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
  incluirHerramientas: false,
  incluirCostosExtras: false,
  incluirHorasTecnicas: false,
  fotoMaxAncho: 75,
  fotoMaxAlto: 55,
  mostrarSoloLista: false,
};

export interface HorasTecnicasPdfData {
  porDia: Array<{
    reporte_codigo: string;
    fecha: string;
    hora_entrada: string;
    hora_salida: string;
    horas_dia: number;
    cantidad_asistentes: number;
    asistentes: Array<{ id: string; nombre: string; area: string }>;
    costo_dia: number;
  }>;
  total: {
    total_horas: number;
    cantidad_tecnicos: number;
    cantidad_reportes: number;
    costo_total: number;
    precio_hora_actual: number;
  } | null;
  incluirCosto: boolean;
  incluirDesglose: boolean;
}

export async function generarPdfObra(args: {
  obra: ObraConRelaciones;
  reportes: ReporteConRelaciones[];
  costos?: ObraCostos | null;
  horasTecnicas?: HorasTecnicasPdfData | null;
  options?: Partial<PdfObraOptions>;
}): Promise<jsPDF> {
  const opts: PdfObraOptions = { ...DEFAULTS, ...args.options };
  const { obra, reportes, costos, horasTecnicas } = args;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = await drawHeader(doc, "Resumen de obra", obra.obra_id);

  // ====== INFO DE LA OBRA ======
  y = sectionTitle(doc, "Datos del proyecto", y);

  const colWidth = (PAGE.width - PAGE.margin * 2) / 2;
  const valueMaxWidth = colWidth - 35 - 2; // ancho de columna menos label menos pequeño margen
  let yLeft = y;
  let yRight = y;
  yLeft = infoRow(doc, "Cliente:", obra.cliente?.nombre ?? "—", PAGE.margin, yLeft, 35, valueMaxWidth);
  yLeft = infoRow(doc, "Obra:", obra.nombre_obra ?? obra.obra_id, PAGE.margin, yLeft, 35, valueMaxWidth);
  if (obra.sitio) yLeft = infoRow(doc, "Sitio:", obra.sitio, PAGE.margin, yLeft, 35, valueMaxWidth);
  if (obra.jefe_obra) yLeft = infoRow(doc, "Jefe obra:", obra.jefe_obra.nombre, PAGE.margin, yLeft, 35, valueMaxWidth);

  yRight = infoRow(doc, "Estado:", obra.estado, PAGE.margin + colWidth, yRight, 35, valueMaxWidth);
  yRight = infoRow(doc, "Inicio:", fmtDate(obra.fecha_inicio_real || obra.fecha_inicio_est), PAGE.margin + colWidth, yRight, 35, valueMaxWidth);
  yRight = infoRow(doc, "Fin:", fmtDate(obra.fecha_fin_real || obra.fecha_fin_est), PAGE.margin + colWidth, yRight, 35, valueMaxWidth);
  if (obra.fecha_inicio_real && obra.fecha_fin_real) {
    yRight = infoRow(doc, "Duración:", `${diasEntre(obra.fecha_inicio_real, obra.fecha_fin_real)} días`, PAGE.margin + colWidth, yRight, 35, valueMaxWidth);
  } else if (obra.fecha_inicio_est && obra.fecha_fin_est) {
    yRight = infoRow(doc, "Duración est.:", `${diasEntre(obra.fecha_inicio_est, obra.fecha_fin_est)} días`, PAGE.margin + colWidth, yRight, 35, valueMaxWidth);
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

          // Grid: hasta 2 por fila. Cada foto entra en un "recuadro" de boxW x boxH
          // pero se dibuja respetando su proporción real (contain, sin estirar).
          const boxW = opts.fotoMaxAncho!;
          const boxH = opts.fotoMaxAlto!;
          const gap = 5;
          const fotosPorFila = 2;

          for (let i = 0; i < validFotos.length; i += fotosPorFila) {
            y = ensureSpace(doc, y, boxH + 4);
            for (let j = 0; j < fotosPorFila && i + j < validFotos.length; j++) {
              const boxX = PAGE.margin + j * (boxW + gap);
              const fmt = detectImageFormat(validFotos[i + j]);
              try {
                // Obtener dimensiones reales de la imagen para calcular proporción
                let drawW = boxW;
                let drawH = boxH;
                let offsetX = 0;
                let offsetY = 0;
                try {
                  const props = doc.getImageProperties(validFotos[i + j]);
                  const imgRatio = props.width / props.height;
                  const boxRatio = boxW / boxH;
                  if (imgRatio > boxRatio) {
                    // Imagen más ancha que el recuadro → limitar por ancho
                    drawW = boxW;
                    drawH = boxW / imgRatio;
                    offsetY = (boxH - drawH) / 2;
                  } else {
                    // Imagen más alta → limitar por alto
                    drawH = boxH;
                    drawW = boxH * imgRatio;
                    offsetX = (boxW - drawW) / 2;
                  }
                } catch {
                  // Si no se pueden leer las props, usar el recuadro completo
                }
                // Fondo gris claro del recuadro (para fotos con bordes transparentes)
                doc.setFillColor(...PDF_COLORS.bg_light);
                doc.rect(boxX, y, boxW, boxH, "F");
                // Dibujar imagen centrada y proporcional
                doc.addImage(
                  validFotos[i + j], fmt,
                  boxX + offsetX, y + offsetY,
                  drawW, drawH,
                );
              } catch (e) {
                doc.setFillColor(...PDF_COLORS.bg_light);
                doc.rect(boxX, y, boxW, boxH, "F");
                doc.setFontSize(7);
                doc.setTextColor(...PDF_COLORS.muted);
                doc.text("(foto no disponible)", boxX + boxW / 2, y + boxH / 2, { align: "center" });
              }
            }
            y += boxH + 4;
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

    // Calcular si hay que sumar horas técnicas al total
    const costoHoras = (opts.incluirHorasTecnicas && horasTecnicas?.incluirCosto && horasTecnicas?.total)
      ? horasTecnicas.total.costo_total : 0;
    const horasHrs = (opts.incluirHorasTecnicas && horasTecnicas?.total) ? horasTecnicas.total.total_horas : 0;
    const totalEjecutadoCostoFinal = costos.total_ejecutado_costo + costoHoras;
    const totalEjecutadoListaFinal = costos.total_ejecutado_lista + costoHoras;
    const margenCostoFinal = costos.presupuesto - totalEjecutadoCostoFinal;
    const margenListaFinal = costos.presupuesto - totalEjecutadoListaFinal;
    const margenCostoPctFinal = costos.presupuesto > 0 ? (margenCostoFinal / costos.presupuesto) * 100 : 0;
    const margenListaPctFinal = costos.presupuesto > 0 ? (margenListaFinal / costos.presupuesto) * 100 : 0;

    // Tabla de KPIs principales
    const tableBody: any[] = [
      ["Presupuesto de obra", fmtMoney(costos.presupuesto), fmtMoney(costos.presupuesto)],
      ["Materiales consumidos", fmtMoney(costos.total_materiales_costo), fmtMoney(costos.total_materiales_lista)],
      ["Compras vinculadas (OCs)", fmtMoney(costos.total_ocs), fmtMoney(costos.total_ocs)],
      ["Herramientas no devueltas", fmtMoney(costos.total_herramientas_no_devueltas), fmtMoney(costos.total_herramientas_no_devueltas)],
      ["Costos extras (tercerizados, etc.)", fmtMoney(costos.total_costos_extras), fmtMoney(costos.total_costos_extras)],
    ];

    // Agregar fila de horas técnicas si corresponde
    if (costoHoras > 0) {
      tableBody.push([
        `Horas técnicas (${horasHrs.toFixed(2)} hs)`,
        fmtMoney(costoHoras),
        fmtMoney(costoHoras),
      ]);
    }

    tableBody.push(
      [
        { content: "Total ejecutado", styles: { fontStyle: "bold" } },
        { content: fmtMoney(totalEjecutadoCostoFinal), styles: { fontStyle: "bold" } },
        { content: fmtMoney(totalEjecutadoListaFinal), styles: { fontStyle: "bold" } },
      ],
      [
        { content: "Margen estimado", styles: { fontStyle: "bold", textColor: PDF_COLORS.primary } },
        {
          content: `${fmtMoney(margenCostoFinal)} (${fmtNumber(margenCostoPctFinal, 1)}%)`,
          styles: {
            fontStyle: "bold",
            textColor: margenCostoFinal >= 0 ? PDF_COLORS.success : PDF_COLORS.danger,
          },
        },
        {
          content: `${fmtMoney(margenListaFinal)} (${fmtNumber(margenListaPctFinal, 1)}%)`,
          styles: {
            fontStyle: "bold",
            textColor: margenListaFinal >= 0 ? PDF_COLORS.success : PDF_COLORS.danger,
          },
        },
      ]
    );

    autoTable(doc, {
      startY: y,
      theme: "plain",
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: PDF_COLORS.primary, textColor: 255, fontStyle: "bold" },
      head: [["Concepto", "A precio costo", "A precio lista"]],
      body: tableBody,
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
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // Costos extras
    if (opts.incluirCostosExtras && costos.costos_extras.length > 0) {
      y = ensureSpace(doc, y, 30);
      y = sectionTitle(doc, "Costos extras (tercerizados, materiales adicionales)", y);

      autoTable(doc, {
        startY: y,
        theme: "striped",
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: PDF_COLORS.primary, textColor: 255, fontStyle: "bold" },
        head: [["Concepto", "Observaciones", "Monto"]],
        columnStyles: { 2: { halign: "right", fontStyle: "bold" } },
        body: [
          ...costos.costos_extras.map(e => [
            e.concepto,
            e.observaciones ?? "",
            fmtMoney(e.monto),
          ]),
          [
            { content: "TOTAL EXTRAS", styles: { fontStyle: "bold" } },
            "",
            { content: fmtMoney(costos.total_costos_extras), styles: { fontStyle: "bold", textColor: PDF_COLORS.primary } },
          ],
        ],
        margin: { left: PAGE.margin, right: PAGE.margin },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }
  }

  // ====== HERRAMIENTAS UTILIZADAS (no van en financiero, pueden ir solas) ======
  if (opts.incluirHerramientas && costos && costos.herramientas.length > 0) {
    if (!opts.incluirFinanciero) {
      doc.addPage();
      y = PAGE.margin + 5;
    } else {
      y = ensureSpace(doc, y, 30);
    }
    y = sectionTitle(doc, "Herramientas utilizadas en la obra", y);

    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text(
      "Lista de herramientas asignadas a técnicos durante la obra. Solo las NO devueltas se cuentan como costo.",
      PAGE.margin, y
    );
    y += 4;

    autoTable(doc, {
      startY: y,
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: PDF_COLORS.primary, textColor: 255, fontStyle: "bold" },
      head: [["Código", "Herramienta", "Técnico", "Cant.", "Estado", opts.incluirFinanciero ? "Costo" : ""].filter(Boolean)],
      columnStyles: opts.incluirFinanciero ? { 5: { halign: "right" } } : {},
      body: costos.herramientas.map(h => {
        const estadoColor = h.estado_final === "Devuelta" ? PDF_COLORS.success
          : h.estado_final === "No devuelta" ? PDF_COLORS.danger
          : PDF_COLORS.warning;
        const row: any[] = [
          h.item_codigo,
          h.descripcion,
          h.tecnico_nombre ?? "—",
          fmtNumber(h.cantidad_retirada, 2),
          { content: h.estado_final, styles: { textColor: estadoColor, fontStyle: "bold" } },
        ];
        if (opts.incluirFinanciero) {
          const costoFinal = h.estado_final === "No devuelta"
            ? h.cantidad_no_devuelta * h.precio_costo : 0;
          row.push(costoFinal > 0 ? fmtMoney(costoFinal) : "—");
        }
        return row;
      }),
      margin: { left: PAGE.margin, right: PAGE.margin },
    });
    y = (doc as any).lastAutoTable.finalY + 4;

    // Resumen herramientas no devueltas
    if (opts.incluirFinanciero && costos.total_herramientas_no_devueltas > 0) {
      doc.setFontSize(9);
      doc.setTextColor(...PDF_COLORS.danger);
      doc.setFont("helvetica", "bold");
      doc.text(
        `Total herramientas no devueltas (sumadas al costo): ${fmtMoney(costos.total_herramientas_no_devueltas)}`,
        PAGE.margin, y
      );
      y += 6;
    }
  }

  // ====== HORAS TÉCNICAS ======
  if (opts.incluirHorasTecnicas && horasTecnicas && horasTecnicas.porDia.length > 0) {
    y = ensureSpace(doc, y, 30);
    y = sectionTitle(doc, "Horas técnicas", y);

    // Resumen
    const total = horasTecnicas.total;
    if (total) {
      doc.setFontSize(10);
      doc.setTextColor(...PDF_COLORS.text);
      doc.setFont("helvetica", "normal");
      const resumenLineas = [
        `Total horas trabajadas: ${total.total_horas.toFixed(2)} hs`,
        `Días trabajados: ${horasTecnicas.porDia.length}`,
        `Técnicos involucrados: ${total.cantidad_tecnicos}`,
      ];
      if (horasTecnicas.incluirCosto) {
        resumenLineas.push(`Precio hora actual: ${fmtMoney(total.precio_hora_actual)}/hr`);
        resumenLineas.push(`Costo total: ${fmtMoney(total.costo_total)}`);
      }
      for (const ln of resumenLineas) {
        doc.text(ln, PAGE.margin, y);
        y += 5;
      }
      y += 3;
    }

    // Desglose por día (opcional)
    if (horasTecnicas.incluirDesglose) {
      const head: any[] = [["Fecha", "Reporte", "Horario", "Asistentes", "Horas"]];
      if (horasTecnicas.incluirCosto) head[0].push("Costo");

      const body = horasTecnicas.porDia.map(d => {
        const asistentesStr = d.asistentes.map(a => a.nombre).join(", ") || "—";
        const row: any[] = [
          fmtDate(d.fecha),
          d.reporte_codigo,
          `${(d.hora_entrada ?? "").slice(0, 5)} - ${(d.hora_salida ?? "").slice(0, 5)}`,
          asistentesStr,
          `${(d.horas_dia * d.cantidad_asistentes).toFixed(2)} hs`,
        ];
        if (horasTecnicas.incluirCosto) {
          row.push(fmtMoney(d.costo_dia));
        }
        return row;
      });

      autoTable(doc, {
        startY: y,
        head,
        body,
        theme: "striped",
        headStyles: { fillColor: PDF_COLORS.primary, textColor: [255, 255, 255], fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 25 },
          2: { cellWidth: 25 },
          4: { halign: "right", cellWidth: 20 },
          ...(horasTecnicas.incluirCosto && { 5: { halign: "right", cellWidth: 25 } }),
        },
        margin: { left: PAGE.margin, right: PAGE.margin },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }
  }

  // Footer en todas las páginas
  paginarTodo(doc);

  return doc;
}
