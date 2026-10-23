import { conApi } from "@/lib/api-publica/autenticar";
import { ok } from "@/lib/api-publica/respuestas";

/** Prueba de conexion: confirma que la llave sirve y dice con que permisos. */
export async function GET(request: Request) {
  return conApi(request, null, async (ctx) => {
    const { data: espacio } = await ctx.admin.from("workspaces").select("name").eq("id", ctx.workspaceId).maybeSingle();
    return ok({ cuenta: espacio?.name ?? null, version: "v1", permisos: ctx.permisos });
  });
}
