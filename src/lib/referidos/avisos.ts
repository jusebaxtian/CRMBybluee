import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUsers } from "@/lib/push/send";

/**
 * Avisa por notificacion del celular a los duenos y administradores de quien
 * gano un mes por referido. Cada recompensa se reclama en la base antes de
 * enviar, asi que correr seguido (o en dos procesos) no la avisa dos veces.
 */
export async function avisarMesesGanados(): Promise<void> {
  const db = createAdminClient();
  const { data: pendientes } = await db
    .from("referral_rewards")
    .select("id, referrer_id")
    .eq("status", "disponible")
    .is("notified_at", null)
    .limit(20);

  for (const premio of pendientes ?? []) {
    const { data: reclamado } = await db
      .from("referral_rewards")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", premio.id)
      .is("notified_at", null)
      .select("id");
    if (!reclamado?.length) continue;

    const { data: miembros } = await db
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", premio.referrer_id)
      .in("role", ["owner", "admin"]);
    await sendPushToUsers(
      db,
      (miembros ?? []).map((m) => m.user_id as string),
      {
        title: "¡Ganaste un mes gratis! 🎉",
        body: "Tu referido activó su licencia. Úsalo cuando quieras desde tu panel.",
        url: "/dashboard",
        tag: "referido",
      }
    );
  }
}
