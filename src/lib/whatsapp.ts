import { formatDate } from "@/lib/utils";

/**
 * Avisos por WhatsApp vía links wa.me: la app abre WhatsApp con el mensaje
 * ya escrito y el usuario solo toca "Enviar". No requiere API ni cuentas.
 */

/**
 * Normaliza un celular argentino al formato que pide wa.me (549 + área + número).
 * Acepta "351 15 123-4567", "0351 1234567", "+54 9 351 1234567", etc.
 * Si no parece un número argentino, devuelve solo los dígitos (ej. números de otro país con +).
 */
export function normalizarTelefono(tel: string | null | undefined): string | null {
  if (!tel) return null;
  const esInternacional = tel.trim().startsWith("+");
  let d = tel.replace(/\D/g, "");
  if (!d) return null;

  if (d.startsWith("54")) {
    d = d.slice(2);
    if (d.startsWith("9")) d = d.slice(1);
  } else if (esInternacional) {
    return d; // otro país: se usa tal cual
  }
  if (d.startsWith("0")) d = d.slice(1);

  // Sacar el "15" que va después del código de área (área de 2 a 4 dígitos)
  if (d.length === 12) {
    for (const largoArea of [2, 3, 4]) {
      if (d.slice(largoArea, largoArea + 2) === "15") {
        d = d.slice(0, largoArea) + d.slice(largoArea + 2);
        break;
      }
    }
  }

  if (d.length !== 10) return null;
  return `549${d}`;
}

/** Link wa.me. Sin teléfono, WhatsApp deja elegir el contacto. */
export function linkWhatsApp(telefono: string | null, texto: string): string {
  const base = telefono ? `https://wa.me/${telefono}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(texto)}`;
}

export interface ObraParaAviso {
  id?: string; // uuid, para armar el link a /obras/:id
  obra_id: string | null;
  nombre_obra: string | null;
  sitio?: string | null;
  maps_url?: string | null;
  fecha_inicio_est?: string | null;
  fecha_fin_est?: string | null;
  alcance_tecnico?: string | null;
  cliente_nombre?: string | null;
  jefe_nombre?: string | null;
}

export function mensajeAsignacion(tecnicoNombre: string, obra: ObraParaAviso): string {
  const primerNombre = tecnicoNombre.trim().split(/\s+/)[0] ?? "";
  const lineas = [
    `Hola ${primerNombre}! 👋`,
    `Te asignaron a la obra *${obra.obra_id ?? ""} — ${obra.nombre_obra ?? "Sin nombre"}*.`,
    "",
    obra.cliente_nombre ? `🏢 Cliente: ${obra.cliente_nombre}` : null,
    obra.sitio ? `📍 Sitio: ${obra.sitio}` : null,
    obra.fecha_inicio_est ? `📅 Inicio: ${formatDate(obra.fecha_inicio_est)}` : null,
    obra.fecha_fin_est ? `🏁 Fin estimado: ${formatDate(obra.fecha_fin_est)}` : null,
    obra.jefe_nombre ? `👷 Jefe de obra: ${obra.jefe_nombre}` : null,
    obra.alcance_tecnico ? `\n📝 Alcance:\n${obra.alcance_tecnico}` : null,
    obra.maps_url ? `\n🗺️ Cómo llegar: ${obra.maps_url}` : null,
    "",
    obra.id
      ? `📲 Ver la obra en la app: ${window.location.origin}/obras/${obra.id}`
      : "Podés ver el detalle en la app de Fibracor.",
  ];
  return lineas.filter(l => l !== null).join("\n");
}
