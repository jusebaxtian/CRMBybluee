import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_SERVER_URL, SUPABASE_ANON_KEY, SUPABASE_COOKIE_NAME } from "./config";

async function crearCliente() {
  const cookieStore = await cookies();

  return createServerClient(
    SUPABASE_SERVER_URL,
    SUPABASE_ANON_KEY,
    {
      cookieOptions: { name: SUPABASE_COOKIE_NAME },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component; middleware refreshes the session instead.
          }
        },
      },
    }
  );
}

/**
 * El usuario se consulta una sola vez por carga de pagina. Cada layout, pagina y
 * ayudante lo pide por su cuenta (mas de 50 lugares) y cada consulta iba al servicio
 * de autenticacion y a la base: una carga de la bandeja repetia lo mismo varias veces.
 *
 * `cache` de React solo guarda dentro de una misma carga en el servidor. En una
 * accion o una ruta de API no guarda nada y se consulta como siempre, asi que un
 * inicio o cierre de sesion nunca ve un usuario viejo.
 */
const usuarioDeEstaCarga = cache(async () => (await crearCliente()).auth.getUser());

export async function createClient() {
  const cliente = await crearCliente();
  const getUserOriginal = cliente.auth.getUser.bind(cliente.auth);
  // Con un token explicito se pregunta por ese token, no por el de la sesion.
  cliente.auth.getUser = (jwt?: string) => (jwt ? getUserOriginal(jwt) : usuarioDeEstaCarga());
  return cliente;
}
