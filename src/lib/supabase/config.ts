// El navegador tiene que hablar con Supabase por el dominio publico, pero el
// servidor de Next corre en la misma maquina que Supabase: salir al dominio
// publico lo obliga a dar la vuelta por DNS + TLS + proxy inverso (~50ms por
// consulta) cuando por la red interna son ~4ms. Como una sola pagina puede
// disparar diez o mas consultas, la diferencia se nota en cada clic.
//
// SUPABASE_INTERNAL_URL es opcional: si no esta definida se usa la publica y
// todo sigue funcionando igual que antes (util en local o si Kong cambia).
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export const SUPABASE_SERVER_URL =
  process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;

export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Supabase deriva el nombre de la cookie de sesion del hostname de la URL
// ("api.crmbybluee.blue" -> "sb-api-auth-token"). Si el servidor usa la URL
// interna y el navegador la publica, cada lado buscaria una cookie distinta y
// las sesiones dejarian de verse. Fijarlo aqui mantiene ambos lados de
// acuerdo, sin importar por que URL entre cada uno.
//
// Tiene que coincidir con el nombre que ya usan las sesiones vivas, o todos
// los clientes conectados quedarian deslogueados de golpe.
export const SUPABASE_COOKIE_NAME = deriveCookieName(SUPABASE_URL);

function deriveCookieName(url: string): string {
  try {
    // Mismo criterio que aplica supabase-js: el primer segmento del host.
    const host = new URL(url).hostname.split(".")[0];
    return `sb-${host}-auth-token`;
  } catch {
    return "sb-auth-token";
  }
}

// Las URLs de archivos (chat-media, banners, plantillas) se guardan en la base
// de datos y despues las abre el NAVEGADOR, no el servidor. getPublicUrl() las
// arma con la URL del cliente que la llama, y los clientes del servidor usan
// SUPABASE_SERVER_URL: sin esto quedarian apuntando a http://localhost:8000,
// que desde el navegador del usuario no existe y el archivo no carga.
//
// Si SUPABASE_INTERNAL_URL no esta definida ambas URLs coinciden y esto no
// hace nada.
export function toPublicUrl(url: string): string {
  if (SUPABASE_SERVER_URL === SUPABASE_URL) return url;
  return url.startsWith(SUPABASE_SERVER_URL)
    ? SUPABASE_URL + url.slice(SUPABASE_SERVER_URL.length)
    : url;
}
