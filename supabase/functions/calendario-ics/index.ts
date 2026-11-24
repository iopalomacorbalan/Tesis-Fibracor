// Edge Function: calendario-ics
// Sirve un calendario en formato iCal (.ics) para suscribirse desde Google Calendar,
// Outlook o el celular ("Agregar calendario > Desde URL"). No necesita cuenta de Google Cloud.
//
//   GET /functions/v1/calendario-ics?t=<token>
//     - token PERSONAL: las obras activas donde la persona es técnico o jefe de obra
//     - token CENTRAL:  un evento por técnico y obra (qué obra tiene cada uno y qué días)
//
// Se publica con  --no-verify-jwt  porque Google Calendar la consulta sin sesión; la seguridad es
// el token secreto (UUID) del enlace, que cada persona puede regenerar desde la app.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ESTADOS_VISIBLES = ["Pendiente OIO", "En ejecucion", "Para cierre", "Cerrada"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ==============================
// Formato iCal
// ==============================

const escapar = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Las líneas de iCal no pueden pasar de 75 caracteres: se parten con un espacio al inicio */
function plegar(linea: string): string {
  const partes: string[] = [];
  let resto = linea;
  while (resto.length > 73) {
    partes.push(resto.slice(0, 73));
    resto = " " + resto.slice(73);
  }
  partes.push(resto);
  return partes.join("\r\n");
}

const fechaIcal = (iso: string) => iso.slice(0, 10).replace(/-/g, "");

function masUnDia(iso: string): string {
  const d = new Date(iso.slice(0, 10) + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

interface Evento {
  uid: string;
  titulo: string;
  descripcion: string;
  lugar?: string | null;
  inicio: string; // YYYY-MM-DD
  fin: string;    // YYYY-MM-DD (inclusive)
  url?: string | null;
}

function construirCalendario(nombre: string, eventos: Evento[]): string {
  const ahora = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FIBRACOR//Obras//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapar(nombre)}`,
    "X-WR-TIMEZONE:America/Argentina/Buenos_Aires",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const e of eventos) {
    lineas.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${ahora}`,
      `DTSTART;VALUE=DATE:${fechaIcal(e.inicio)}`,
      `DTEND;VALUE=DATE:${fechaIcal(masUnDia(e.fin))}`, // en iCal el fin de un evento de día completo es exclusivo
      `SUMMARY:${escapar(e.titulo)}`,
      `DESCRIPTION:${escapar(e.descripcion)}`,
    );
    if (e.lugar) lineas.push(`LOCATION:${escapar(e.lugar)}`);
    if (e.url) lineas.push(`URL:${e.url}`);
    lineas.push("TRANSP:TRANSPARENT", "END:VEVENT");
  }
  lineas.push("END:VCALENDAR");
  return lineas.map(plegar).join("\r\n") + "\r\n";
}

// ==============================
// Datos
// ==============================

async function obrasConEquipo(filtro?: { usuarioId: string }) {
  const { data: obras, error } = await admin
    .from("obras")
    .select(`
      id, obra_id, nombre_obra, estado, sitio, alcance_tecnico, maps_url,
      fecha_inicio_est, fecha_fin_est, fecha_inicio_real, fecha_fin_real, jefe_obra_id,
      cliente:clientes(nombre),
      jefe_obra:usuarios!obras_jefe_obra_id_fkey(id, nombre),
      obra_tecnicos(usuario:usuarios!obra_tecnicos_tecnico_id_fkey(id, nombre))
    `)
    .in("estado", ESTADOS_VISIBLES);
  if (error) throw new Error(error.message);

  const desde = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  return (obras ?? [])
    .map((o: any) => ({
      ...o,
      tecnicos: (o.obra_tecnicos ?? []).map((ot: any) => ot.usuario).filter(Boolean),
      inicio: o.fecha_inicio_real ?? o.fecha_inicio_est,
      fin: o.fecha_fin_real ?? o.fecha_fin_est ?? o.fecha_inicio_real ?? o.fecha_inicio_est,
    }))
    .filter((o: any) => o.inicio && o.fin >= desde) // sin fecha no hay evento; las cerradas hace mucho no se muestran
    .filter((o: any) =>
      !filtro ||
      o.jefe_obra_id === filtro.usuarioId ||
      o.tecnicos.some((t: any) => t.id === filtro.usuarioId));
}

function descripcionDe(o: any, rol?: string) {
  const equipo = o.tecnicos.map((t: any) => t.nombre).join(", ") || "—";
  return [
    rol ? `Tu rol: ${rol}` : null,
    `Cliente: ${o.cliente?.nombre ?? "—"}`,
    `Jefe de obra: ${o.jefe_obra?.nombre ?? "—"}`,
    `Equipo: ${equipo}`,
    `Estado: ${o.estado}`,
    o.alcance_tecnico ? `Alcance: ${o.alcance_tecnico}` : null,
    o.maps_url ? `Cómo llegar: ${o.maps_url}` : null,
  ].filter(Boolean).join("\n");
}

const tituloObra = (o: any) => `${o.obra_id ?? ""} — ${o.nombre_obra ?? "Obra sin nombre"}`;

async function calendarioPersonal(usuarioId: string) {
  const { data: u } = await admin.from("usuarios").select("nombre, activo").eq("id", usuarioId).maybeSingle();
  if (!u?.activo) return null;
  const obras = await obrasConEquipo({ usuarioId });
  const eventos: Evento[] = obras.map((o: any) => {
    const esTecnico = o.tecnicos.some((t: any) => t.id === usuarioId);
    const esJefe = o.jefe_obra_id === usuarioId;
    const rol = esTecnico && esJefe ? "Jefe de obra y técnico" : esJefe ? "Jefe de obra" : "Técnico";
    return {
      uid: `obra-${o.id}-${usuarioId}@fibracor`,
      titulo: tituloObra(o),
      descripcion: descripcionDe(o, rol),
      lugar: o.sitio,
      inicio: o.inicio,
      fin: o.fin,
      url: o.maps_url,
    };
  });
  return construirCalendario(`FIBRACOR · Mis obras (${u.nombre})`, eventos);
}

async function calendarioCentral() {
  const obras = await obrasConEquipo();
  const eventos: Evento[] = [];
  for (const o of obras) {
    if (o.tecnicos.length === 0) {
      eventos.push({
        uid: `obra-${o.id}-sin-tecnicos@fibracor`,
        titulo: `${tituloObra(o)} (sin técnicos asignados)`,
        descripcion: descripcionDe(o),
        lugar: o.sitio, inicio: o.inicio, fin: o.fin, url: o.maps_url,
      });
      continue;
    }
    for (const t of o.tecnicos) {
      eventos.push({
        uid: `obra-${o.id}-${t.id}@fibracor`,
        titulo: `${t.nombre} · ${tituloObra(o)}`,
        descripcion: descripcionDe(o),
        lugar: o.sitio, inicio: o.inicio, fin: o.fin, url: o.maps_url,
      });
    }
  }
  return construirCalendario("FIBRACOR · Técnicos y obras", eventos);
}

// ==============================
// Entrada
// ==============================

const noExiste = () => new Response("No encontrado", { status: 404 });

Deno.serve(async (req) => {
  if (req.method !== "GET") return new Response("Método no permitido", { status: 405 });
  try {
    const token = new URL(req.url).searchParams.get("t") ?? "";
    if (!UUID_RE.test(token)) return noExiste();

    const { data: enlace } = await admin
      .from("calendario_enlaces").select("usuario_id, central").eq("token", token).maybeSingle();
    if (!enlace) return noExiste();

    const ics = enlace.central ? await calendarioCentral() : await calendarioPersonal(enlace.usuario_id);
    if (!ics) return noExiste();

    return new Response(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="fibracor.ics"',
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (e: any) {
    console.error("calendario-ics:", e);
    return new Response("Error interno", { status: 500 });
  }
});
