import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sincronizarConexion } from "@/lib/integraciones/google/sincronizar";

/**
 * Aviso de Google: "algo cambio en el calendario". No trae contenido. Se
 * comprueba el canal y su secreto, se responde de inmediato y se revisan las
 * citas del CRM de esa conexion en segundo plano.
 */
export async function POST(request: NextRequest) {
  const canalId = request.headers.get("x-goog-channel-id");
  const token = request.headers.get("x-goog-channel-token");
  const estado = request.headers.get("x-goog-resource-state");
  if (!canalId || !token) return new NextResponse(null, { status: 400 });

  const supabase = createAdminClient();
  const { data: conexion } = await supabase
    .from("integraciones_conexiones")
    .select("id, token_cifrado, estado, canal_secreto")
    .eq("canal_id", canalId)
    .maybeSingle();
  if (!conexion?.canal_secreto) return new NextResponse(null, { status: 404 });

  const esperado = Buffer.from(conexion.canal_secreto as string);
  const recibido = Buffer.from(token);
  if (esperado.length !== recibido.length || !timingSafeEqual(esperado, recibido)) return new NextResponse(null, { status: 403 });

  // "sync" es el aviso de que el canal quedo abierto: no hay nada que revisar.
  if (estado !== "sync") {
    void sincronizarConexion(supabase, {
      id: conexion.id as string,
      token_cifrado: conexion.token_cifrado as string,
      estado: conexion.estado as string,
    }).catch((err) => console.error("google calendar: fallo la revision por aviso:", err instanceof Error ? err.message : err));
  }
  return NextResponse.json({ ok: true });
}
