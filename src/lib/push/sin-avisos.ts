import { createAdminClient } from "@/lib/supabase/admin";

export const DIAS_ACTIVO = 14;

export type FilaUsuario = { id: string; correo: string; espacio: string; rol: string; ultimo: string; tel: string | null };

/**
 * Usuarios de cuentas activas que entraron en los ultimos 14 dias, y cuales de
 * ellos no tienen las notificaciones activadas en ningun dispositivo.
 */
export async function usuariosActivosYSinAvisos(): Promise<{ activos: FilaUsuario[]; sinAvisos: FilaUsuario[] }> {
  const admin = createAdminClient();
  const desde = Date.now() - DIAS_ACTIVO * 86_400_000;

  const [{ data: miembros }, { data: suscripciones }, { data: lista }] = await Promise.all([
    admin.from("workspace_members").select("user_id, role, workspaces(name, status, phone)"),
    admin.from("push_subscriptions").select("user_id"),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  const conPush = new Set((suscripciones ?? []).map((s) => s.user_id as string));
  const usuarios = new Map((lista?.users ?? []).map((u) => [u.id, u]));

  const activos: FilaUsuario[] = [];
  for (const m of miembros ?? []) {
    const u = usuarios.get(m.user_id as string);
    const w = m.workspaces as unknown as { name: string; status: string; phone: string | null } | null;
    if (!u?.last_sign_in_at || !w) continue;
    if (w.status !== "active" && w.status !== "trialing") continue;
    if (new Date(u.last_sign_in_at).getTime() < desde) continue;
    activos.push({ id: u.id, correo: u.email ?? "", espacio: w.name, rol: m.role as string, ultimo: u.last_sign_in_at, tel: w.phone });
  }

  const sinAvisos = activos.filter((f) => !conPush.has(f.id)).sort((a, b) => b.ultimo.localeCompare(a.ultimo));
  return { activos, sinAvisos };
}
