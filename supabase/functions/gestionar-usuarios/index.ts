// Edge Function: gestionar-usuarios
// Alta y edición de usuarios (Auth + tabla usuarios) desde la app.
// Necesita la service role, por eso no se puede hacer desde el navegador.
//
// Permisos:
//   - Direccion: puede crear/editar usuarios de cualquier área.
//   - Operaciones: solo puede crear/editar técnicos.
//
// Acciones (body JSON):
//   { accion: "crear", email, password, nombre, area, telefono? }
//   { accion: "editar", id, nombre?, area?, telefono?, activo? }
//   { accion: "cambiar_password", id, password }

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const AREAS = ["Direccion", "Operaciones", "Paniol", "Comercial", "Contabilidad", "Tecnico"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// ==============================
// Quién llama
// ==============================

async function getSolicitante(req: Request) {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) throw new HttpError(401, "Falta sesión");

  const { data: { user }, error } = await admin.auth.getUser(jwt);
  if (error || !user) throw new HttpError(401, "Sesión inválida");

  const { data: perfil } = await admin
    .from("usuarios").select("id, area, activo").eq("id", user.id).single();

  if (!perfil?.activo || !["Direccion", "Operaciones"].includes(perfil.area)) {
    throw new HttpError(403, "Solo Dirección u Operaciones pueden gestionar usuarios");
  }
  return perfil as { id: string; area: string };
}

function validarArea(area: string, solicitante: { area: string }) {
  if (!AREAS.includes(area)) throw new HttpError(400, `Área inválida: ${area}`);
  if (solicitante.area !== "Direccion" && area !== "Tecnico") {
    throw new HttpError(403, "Operaciones solo puede gestionar técnicos");
  }
}

function validarPassword(password: unknown) {
  if (typeof password !== "string" || password.length < 6) {
    throw new HttpError(400, "La contraseña debe tener al menos 6 caracteres");
  }
}

// ==============================
// Acciones
// ==============================

async function crear(body: any, solicitante: { area: string }) {
  const email = String(body.email ?? "").trim().toLowerCase();
  const nombre = String(body.nombre ?? "").trim();
  const area = String(body.area ?? "Tecnico");
  const telefono = String(body.telefono ?? "").trim() || null;

  if (!email.includes("@")) throw new HttpError(400, "Email inválido");
  if (!nombre) throw new HttpError(400, "Falta el nombre");
  validarPassword(body.password);
  validarArea(area, solicitante);

  const { data: creado, error: errAuth } = await admin.auth.admin.createUser({
    email,
    password: body.password,
    email_confirm: true,
    user_metadata: { nombre },
  });
  if (errAuth || !creado.user) {
    const msg = errAuth?.message ?? "No se pudo crear el usuario";
    throw new HttpError(400, /already|registered|exists/i.test(msg) ? "Ya existe un usuario con ese email" : msg);
  }

  const { data: perfil, error: errPerfil } = await admin
    .from("usuarios")
    .insert({ id: creado.user.id, user_id: creado.user.id, email, nombre, area, telefono, activo: true })
    .select()
    .single();

  if (errPerfil) {
    // Rollback: que no quede un usuario de Auth sin perfil
    await admin.auth.admin.deleteUser(creado.user.id);
    throw new HttpError(400, `No se pudo crear el perfil: ${errPerfil.message}`);
  }
  return perfil;
}

async function editar(body: any, solicitante: { id: string; area: string }) {
  const id = String(body.id ?? "");
  if (!id) throw new HttpError(400, "Falta el id");

  const { data: actual } = await admin.from("usuarios").select("area").eq("id", id).single();
  if (!actual) throw new HttpError(404, "Usuario no encontrado");
  validarArea(actual.area, solicitante); // Operaciones no puede tocar a no-técnicos

  const patch: Record<string, unknown> = {};
  if (body.nombre !== undefined) {
    const nombre = String(body.nombre).trim();
    if (!nombre) throw new HttpError(400, "El nombre no puede quedar vacío");
    patch.nombre = nombre;
  }
  if (body.telefono !== undefined) patch.telefono = String(body.telefono ?? "").trim() || null;
  if (body.area !== undefined && body.area !== actual.area) {
    if (id === solicitante.id) {
      throw new HttpError(400, "No podés cambiar tu propia área");
    }
    validarArea(String(body.area), solicitante);
    patch.area = body.area;
  }
  if (body.activo !== undefined) {
    if (id === solicitante.id && body.activo === false) {
      throw new HttpError(400, "No podés desactivar tu propio usuario");
    }
    patch.activo = !!body.activo;
    // Un usuario inactivo no puede iniciar sesión
    const { error } = await admin.auth.admin.updateUserById(id, {
      ban_duration: body.activo ? "none" : "876000h",
    });
    if (error) throw new HttpError(400, error.message);
  }

  const { data, error } = await admin.from("usuarios").update(patch).eq("id", id).select().single();
  if (error) throw new HttpError(400, error.message);
  return data;
}

async function cambiarPassword(body: any, solicitante: { area: string }) {
  const id = String(body.id ?? "");
  validarPassword(body.password);

  const { data: actual } = await admin.from("usuarios").select("area").eq("id", id).single();
  if (!actual) throw new HttpError(404, "Usuario no encontrado");
  validarArea(actual.area, solicitante);

  const { error } = await admin.auth.admin.updateUserById(id, { password: body.password });
  if (error) throw new HttpError(400, error.message);
  return { ok: true };
}

// ==============================
// Handler principal
// ==============================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const solicitante = await getSolicitante(req);
    const body = await req.json();

    switch (body.accion) {
      case "crear": return json(await crear(body, solicitante));
      case "editar": return json(await editar(body, solicitante));
      case "cambiar_password": return json(await cambiarPassword(body, solicitante));
      default: throw new HttpError(400, `Acción desconocida: ${body.accion}`);
    }
  } catch (e: any) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status === 500) console.error("Error gestionar-usuarios:", e);
    return json({ error: e.message }, status);
  }
});
