import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";

/**
 * Chats realmente sin leer de quien pregunta. La app lo usa al abrirse o volver
 * al primer plano para cuadrar la insignia del icono y cerrar los avisos de
 * chats que ya se leyeron.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return NextResponse.json({ total: 0, chats: [] });

  const [{ data: total }, { data: filas }] = await Promise.all([
    supabase.rpc("chats_sin_leer_total", { p_workspace: workspaceId, p_user: user.id }),
    supabase.rpc("chats_sin_leer", { p_workspace: workspaceId, p_user: user.id }),
  ]);

  const chats = ((filas ?? []) as { conversation_id: string }[]).slice(0, 300).map((f) => f.conversation_id);
  return NextResponse.json({ total: Number(total ?? chats.length), chats }, { headers: { "Cache-Control": "no-store" } });
}
