import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Faltan variables de entorno: VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY"
  );
}

// Note: no le pasamos el genérico Database para evitar errores de tipado estricto.
// Los tipos de los rows los aplicamos manualmente en cada hook con `as` cuando hace falta.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
