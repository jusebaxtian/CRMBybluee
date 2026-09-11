import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId, getWorkspaceRole } from "@/lib/workspace";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;
export type WorkspaceRole = "owner" | "admin" | "agent";

export type WorkspaceContext = {
  supabase: SupabaseServer;
  workspaceId: string;
};

/**
 * Mensaje unico para "no hay espacio de trabajo".
 *
 * Estaba copiado literal en 43 acciones. Cambiarlo obligaba a editarlas todas,
 * y era facil que una quedara con otra redaccion.
 */
export const NO_WORKSPACE_ERROR = "No se encontró tu workspace." as const;

/**
 * Resuelve el espacio de trabajo del usuario actual.
 *
 * Antes cada accion abria con las mismas tres lineas: crear el cliente,
 * resolver el espacio y devolver error si no habia. Cincuenta y cuatro
 * repeticiones del mismo preambulo, y una accion nueva que lo olvidara no
 * fallaba de forma visible: simplemente quedaba sin control de acceso.
 *
 * Uso:
 *
 *   const ctx = await requireWorkspace();
 *   if ("error" in ctx) return { error: ctx.error };
 *   const { supabase, workspaceId } = ctx;
 *
 * OJO: se devuelve un literal y no `ctx`. Si se retorna el objeto tipado, la
 * union que infiere TypeScript para la accion cambia, y los componentes que
 * hacen `result?.error` dejan de compilar.
 */
export async function requireWorkspace(): Promise<WorkspaceContext | { error: string }> {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: NO_WORKSPACE_ERROR };
  return { supabase, workspaceId };
}

/**
 * Igual que requireWorkspace, pero ademas exige uno de los roles indicados.
 *
 * `mensajeSinPermiso` se muestra al usuario, asi que conviene que diga que no
 * pudo hacer, no que rol le falta.
 */
export async function requireWorkspaceRole(
  rolesPermitidos: WorkspaceRole[],
  mensajeSinPermiso: string
): Promise<(WorkspaceContext & { role: WorkspaceRole }) | { error: string }> {
  const ctx = await requireWorkspace();
  if ("error" in ctx) return ctx;

  const role = (await getWorkspaceRole(ctx.supabase, ctx.workspaceId)) as WorkspaceRole | null;
  if (!role || !rolesPermitidos.includes(role)) return { error: mensajeSinPermiso };

  return { ...ctx, role };
}
