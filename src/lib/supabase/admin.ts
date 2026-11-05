import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_SERVER_URL } from "./config";

// Service-role client: bypasses RLS. Server-only — never import from client components.
export function createAdminClient() {
  return createSupabaseClient(
    SUPABASE_SERVER_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    // Sin esto, cada cliente arranca en el servidor un temporizador de renovacion
    // de sesion cada 30 s que nunca se detiene y deja viva la peticion completa
    // (fuga hallada el 4 nov 2026: 2 GB por hora y un reinicio cada hora y pico).
    // Con la llave de servicio no hay sesion que renovar ni guardar.
    { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } }
  );
}
