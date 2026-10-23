import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUsers } from "@/lib/push/send";

// Una prueba cada pocos segundos por persona: es un boton, no un canal de envio.
const ESPERA_MS = 5_000;
const ultima = new Map<string, number>();

/** Manda una notificacion de prueba a los dispositivos de quien la pide y dice cuantos la recibieron. */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ahora = Date.now();
  if (ahora - (ultima.get(user.id) ?? 0) < ESPERA_MS) {
    return NextResponse.json({ error: "Espera unos segundos antes de otra prueba." }, { status: 429 });
  }
  ultima.set(user.id, ahora);

  const admin = createAdminClient();
  const { count } = await admin.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  if (!count) {
    return NextResponse.json({ ok: false, dispositivos: 0, enviados: 0, motivo: "Este dispositivo todavía no está registrado. Activa las notificaciones primero." });
  }

  const enviados = await sendPushToUsers(admin, [user.id], {
    title: "Notificación de prueba ✓",
    body: "Así te avisaremos cuando llegue un mensaje nuevo.",
    url: "/dashboard/inbox",
    tag: "prueba",
  });
  return NextResponse.json({ ok: enviados > 0, dispositivos: count, enviados });
}
