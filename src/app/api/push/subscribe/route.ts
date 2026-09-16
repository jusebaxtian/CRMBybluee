import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const subscription = await request.json();
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const authKey = subscription?.keys?.auth;

  if (!endpoint || !p256dh || !authKey) {
    return NextResponse.json({ error: "invalid subscription" }, { status: 400 });
  }

  // El endpoint identifica al dispositivo; si ya estaba registrado con otro
  // usuario (mismo telefono, otra cuenta, o el admin "entrando como"), la
  // suscripcion pasa al usuario actual. Con RLS no habia politica de update
  // y el upsert fallaba con 500 en cada carga de la app.
  const admin = createAdminClient();
  await admin.from("push_subscriptions").delete().eq("endpoint", endpoint).neq("user_id", user.id);
  const { error } = await admin.from("push_subscriptions").upsert(
    { user_id: user.id, endpoint, p256dh, auth_key: authKey },
    { onConflict: "endpoint" }
  );

  if (error) {
    console.error("push subscribe:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { endpoint } = await request.json();
  if (!endpoint) {
    return NextResponse.json({ error: "invalid endpoint" }, { status: 400 });
  }

  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);

  return NextResponse.json({ ok: true });
}
