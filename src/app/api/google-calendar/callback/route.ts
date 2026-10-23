import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cifrar, leerEstado } from "@/lib/integraciones/cifrado";
import { canjearCodigo, correoDeGoogle, faltaPermisoDeEventos } from "@/lib/integraciones/google/oauth";
import { espacioParaConectar, origenPublico, uriDeRetorno } from "@/lib/integraciones/google/contexto";
import { asegurarPlantillasDeCita } from "@/lib/agenda/plantillas-cita";

/**
 * Vuelta de Google: valida que la conexion la inicio esta misma persona,
 * canjea el codigo, comprueba que concedio el permiso de eventos y guarda el
 * token cifrado. Siempre termina en Configuracion -> Integraciones.
 */
export async function GET(request: NextRequest) {
  const origen = origenPublico(request.headers, request.url);
  const termina = (motivo: string) => {
    const r = NextResponse.redirect(`${origen}/dashboard/settings?tab=integraciones&google=${motivo}`);
    r.cookies.delete({ name: "gcal_estado", path: "/api/google-calendar" });
    return r;
  };

  const { searchParams } = new URL(request.url);
  // La persona toco "Cancelar" en la pantalla de Google.
  if (searchParams.get("error")) return termina("cancelado");

  const code = searchParams.get("code");
  const estado = searchParams.get("state");
  if (!code || !estado) return termina("error");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origen}/login`);

  // El estado tiene que estar firmado por nosotros, vigente, ser de ESTA persona y
  // coincidir con la cookie que dejo el navegador al empezar.
  const cookie = request.cookies.get("gcal_estado")?.value;
  if (!cookie || cookie !== estado || leerEstado(estado) !== user.id) return termina("error");

  const espacio = await espacioParaConectar(supabase, user.id);
  if ("error" in espacio) return termina(espacio.error);

  try {
    const tokens = await canjearCodigo({
      code,
      clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET ?? "",
      redirectUri: uriDeRetorno(origen),
    });

    if (faltaPermisoDeEventos(tokens.scope)) return termina("sin_permiso");
    if (!tokens.refresh_token) return termina("sin_renovacion");

    const correo = await correoDeGoogle(tokens.access_token);

    const admin = createAdminClient();
    const { error } = await admin.from("integraciones_conexiones").upsert(
      {
        workspace_id: espacio.workspaceId,
        user_id: user.id,
        proveedor: "google_calendar",
        cuenta_email: correo,
        token_cifrado: cifrar(tokens.refresh_token),
        alcances: tokens.scope ?? null,
        estado: "conectado",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,proveedor" }
    );
    if (error) {
      console.error("google calendar: no se pudo guardar la conexion:", error.message);
      return termina("error");
    }
    // Las plantillas con las que se confirman las citas por WhatsApp se crean solas la
    // primera vez que alguien del espacio conecta su Google. No se espera el resultado:
    // Meta tarda y un fallo aqui no debe afectar la conexion (se reintenta desde la cita).
    void asegurarPlantillasDeCita(admin, espacio.workspaceId)
      .then((r) => {
        if (r.fallos.length > 0) console.error("plantillas de cita:", r.fallos.join(" | "));
      })
      .catch((err) => console.error("plantillas de cita:", err instanceof Error ? err.message : err));
    return termina("ok");
  } catch (err) {
    console.error("google calendar: fallo la conexion:", err instanceof Error ? err.message : err);
    return termina("error");
  }
}
