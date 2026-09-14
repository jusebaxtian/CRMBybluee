import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Vuelta de Google (OAuth con PKCE): canjea el codigo por la sesion y decide
 * a donde va la persona.
 *
 * - Ya tiene espacio (entro con el mismo correo con el que se registro, o ya
 *   habia entrado con Google antes): al panel.
 * - Es nueva: a completar el registro, porque Google no nos da el nombre del
 *   negocio ni el WhatsApp, y sin ellos no se crea el espacio.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const errorDescription = searchParams.get("error_description");

  if (!code) {
    const motivo = errorDescription ? encodeURIComponent(errorDescription) : "google";
    return NextResponse.redirect(`${origin}/login?error=${motivo}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("google callback: no se pudo canjear el codigo:", error.message);
    return NextResponse.redirect(`${origin}/login?error=google`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login?error=google`);

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  return NextResponse.redirect(`${origin}${membership ? "/dashboard" : "/completar-registro"}`);
}
