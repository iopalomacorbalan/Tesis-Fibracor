// Edge Function: sync-google-calendar
// Sincroniza una obra de FIBRACOR con Google Calendar usando una Service Account.
//
// Setup required (Supabase secrets):
//   - GOOGLE_SERVICE_ACCOUNT_JSON: JSON completo de la service account
//   - GOOGLE_CALENDAR_ID: ID del calendar destino (opcional, lo lee de la BD también)

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_SA_JSON = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ==============================
// Auth con Service Account
// ==============================

async function getAccessToken(): Promise<string> {
  const sa = JSON.parse(GOOGLE_SA_JSON);
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600;

  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/calendar",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp,
  };

  const b64url = (obj: any) =>
    btoa(JSON.stringify(obj))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const unsigned = `${b64url(header)}.${b64url(claim)}`;

  // Importar clave privada
  const pem = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const keyDer = Uint8Array.from(atob(pem), c => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyDer.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const enc = new TextEncoder().encode(unsigned);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc);

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${unsigned}.${sigB64}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    const t = await tokenRes.text();
    throw new Error(`Auth Google falló: ${t}`);
  }

  const j = await tokenRes.json();
  return j.access_token;
}

// ==============================
// Construir evento desde obra
// ==============================

function obraToEvent(obra: any, zonaHoraria: string) {
  const start = obra.fecha_inicio_real ?? obra.fecha_inicio_est;
  const end = obra.fecha_fin_real ?? obra.fecha_fin_est ?? start;

  const tecnicos = (obra.tecnicos ?? []).map((t: any) => t.nombre).join(", ") || "—";
  const jefe = obra.jefe_obra?.nombre ?? "—";
  const cliente = obra.cliente?.nombre ?? "—";

  const descripcion = [
    obra.descripcion ? `📋 ${obra.descripcion}` : null,
    `Cliente: ${cliente}`,
    `Jefe de obra: ${jefe}`,
    `Técnicos: ${tecnicos}`,
    `Estado: ${obra.estado}`,
    obra.obra_id ? `Código: ${obra.obra_id}` : null,
    `\n🔗 Sincronizado desde FIBRACOR CRM`,
  ].filter(Boolean).join("\n");

  return {
    summary: `${obra.obra_id ?? ""} — ${obra.nombre_obra ?? "Obra sin nombre"}`,
    description: descripcion,
    location: obra.direccion ?? undefined,
    start: { date: start, timeZone: zonaHoraria },
    end: { date: addDays(end, 1), timeZone: zonaHoraria }, // Google usa fin exclusivo
    colorId: colorByEstado(obra.estado),
  };
}

function colorByEstado(estado: string): string {
  // colorId de Google Calendar (1-11)
  switch (estado) {
    case "En ejecucion": return "2";    // verde
    case "Pendiente OIO": return "5";   // amarillo
    case "Para cierre": return "6";     // naranja
    case "Cerrada": return "8";         // gris
    case "Cancelada": return "11";      // rojo
    default: return "1";
  }
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ==============================
// Operaciones Calendar API
// ==============================

async function createEvent(calId: string, token: string, body: any): Promise<string> {
  const r = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!r.ok) throw new Error(`Create event falló: ${await r.text()}`);
  const j = await r.json();
  return j.id;
}

async function updateEvent(calId: string, eventId: string, token: string, body: any): Promise<void> {
  const r = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${eventId}`,
    {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!r.ok) throw new Error(`Update event falló: ${await r.text()}`);
}

async function deleteEvent(calId: string, eventId: string, token: string): Promise<void> {
  const r = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${eventId}`,
    {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` },
    },
  );
  if (!r.ok && r.status !== 410 && r.status !== 404) {
    throw new Error(`Delete event falló: ${await r.text()}`);
  }
}

// ==============================
// Handler principal
// ==============================

Deno.serve(async (req) => {
  try {
    const { obra_id, accion } = await req.json();

    if (!obra_id || !accion) {
      return new Response(JSON.stringify({ error: "obra_id y accion son requeridos" }), { status: 400 });
    }

    // Leer config
    const { data: cfg } = await supabase
      .from("google_calendar_config")
      .select("*").eq("id", 1).single();

    if (!cfg?.habilitado || !cfg?.calendar_id) {
      await logSync(obra_id, null, accion, "skipped", "Google sync no habilitado o sin calendar_id");
      return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 });
    }

    const token = await getAccessToken();
    const calendarId = cfg.calendar_id;
    const zonaHoraria = cfg.zona_horaria ?? "America/Argentina/Buenos_Aires";

    // DELETE
    if (accion === "delete") {
      // No tenemos NEW.id pero sí el obra_id antes del borrado. Usamos el log o leemos el último google_event_id si quedó
      // En la práctica: en DELETE, el trigger nos manda el OLD.id pero la fila ya no existe.
      // Estrategia: buscar en log el último google_event_id de esa obra.
      const { data: ultimoLog } = await supabase
        .from("google_sync_log")
        .select("google_event_id")
        .eq("obra_id", obra_id)
        .not("google_event_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ultimoLog?.google_event_id) {
        await deleteEvent(calendarId, ultimoLog.google_event_id, token);
        await logSync(obra_id, ultimoLog.google_event_id, accion, "ok");
      } else {
        await logSync(obra_id, null, accion, "skipped", "No había google_event_id para borrar");
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // Para create/update: leer obra completa
    const { data: obra, error: errObra } = await supabase
      .from("obras")
      .select(`
        *,
        cliente:clientes(*),
        jefe_obra:usuarios!obras_jefe_obra_id_fkey(*),
        obra_tecnicos(usuario:usuarios!obra_tecnicos_tecnico_id_fkey(*))
      `)
      .eq("id", obra_id)
      .single();

    if (errObra || !obra) {
      await logSync(obra_id, null, accion, "error", `No se encontró la obra: ${errObra?.message}`);
      return new Response(JSON.stringify({ error: "Obra no encontrada" }), { status: 404 });
    }

    // Aplanar técnicos
    obra.tecnicos = (obra.obra_tecnicos ?? []).map((ot: any) => ot.usuario);

    // No sincronizar obras sin fecha
    if (!obra.fecha_inicio_est && !obra.fecha_inicio_real) {
      await logSync(obra_id, null, accion, "skipped", "Obra sin fecha de inicio");
      return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 });
    }

    const eventBody = obraToEvent(obra, zonaHoraria);

    if (accion === "create" || !obra.google_event_id) {
      const eventId = await createEvent(calendarId, token, eventBody);
      await supabase
        .from("obras")
        .update({ google_event_id: eventId, google_last_sync: new Date().toISOString(), google_sync_error: null })
        .eq("id", obra_id);
      await logSync(obra_id, eventId, "create", "ok", null, eventBody);
    } else {
      await updateEvent(calendarId, obra.google_event_id, token, eventBody);
      await supabase
        .from("obras")
        .update({ google_last_sync: new Date().toISOString(), google_sync_error: null })
        .eq("id", obra_id);
      await logSync(obra_id, obra.google_event_id, "update", "ok", null, eventBody);
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e: any) {
    console.error("Error sync:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});

async function logSync(
  obraId: string | null,
  eventId: string | null,
  accion: string,
  resultado: string,
  errorMsg: string | null = null,
  payload: any = null,
) {
  try {
    let obraCodigo: string | null = null;
    if (obraId) {
      const { data } = await supabase.from("obras").select("obra_id").eq("id", obraId).single();
      obraCodigo = data?.obra_id ?? null;
    }

    await supabase.from("google_sync_log").insert({
      obra_id: obraId,
      obra_codigo: obraCodigo,
      accion,
      resultado,
      google_event_id: eventId,
      error_msg: errorMsg,
      payload,
    });

    // Si fue error, también guardarlo en obra
    if (resultado === "error" && obraId) {
      await supabase.from("obras")
        .update({ google_sync_error: errorMsg })
        .eq("id", obraId);
    }
  } catch (e) {
    console.error("Error guardando log:", e);
  }
}
