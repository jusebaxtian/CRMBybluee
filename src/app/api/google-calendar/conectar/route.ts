import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { firmarEstado } from "@/lib/integraciones/cifrado";
import { urlDeAutorizacion } from "@/lib/integraciones/google/oauth";
import { espacioParaConectar, origenPublico, uriDeRetorno } from "@/lib/integraciones/google/contexto";
import { duenoEnModoSoporte } from "@/lib/agenda/contexto-de-cita";
import { getWorkspaceId } from "@/lib/workspace";

/**
 * Empieza la conexion con Google: manda a la persona a la pantalla de permisos.
 * El estado va firmado y tambien en una cookie, para que la vuelta solo valga
 * si la inicio este mismo navegador.
 */
export async function GET(request: NextRequest) {
  const origen = origenPublico(request.headers, request.url);
  const volver = (motivo: string) => NextResponse.redirect(`${origen}/dashboard/settings?tab=integraciones&google=${motivo}`);

  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  if (!clientId || !process.env.GOOGLE_CALENDAR_CLIENT_SECRET) return volver("sin_configurar");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origen}/login`);
  // En modo soporte se conectaria el Google del administrador, no el del cliente.
  if (await duenoEnModoSoporte(supabase, await getWorkspaceId(supabase))) return volver("modo_soporte");

  const espacio = await espacioParaConectar(supabase, user.id);
  if ("error" in espacio) return volver(espacio.error);

  const estado = firmarEstado(user.id);
  const respuesta = NextResponse.redirect(urlDeAutorizacion({ clientId, redirectUri: uriDeRetorno(origen), estado }));
  respuesta.cookies.set("gcal_estado", estado, {
    httpOnly: true,
    secure: origen.startsWith("https://"),
    sameSite: "lax",
    path: "/api/google-calendar",
    maxAge: 600,
  });
  return respuesta;
}
