import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_COOKIE_NAME } from "./config";

export function createClient() {
  // El navegador siempre por el dominio publico; la cookie se fija para que
  // coincida con la que lee el servidor por la URL interna.
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookieOptions: { name: SUPABASE_COOKIE_NAME },
  });
}
