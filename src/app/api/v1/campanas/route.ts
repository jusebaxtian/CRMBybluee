import { conApi } from "@/lib/api-publica/autenticar";
import { COLUMNAS_CAMPANA, campanaPublica, crearCampanaApi } from "@/lib/api-publica/campanas";
import { cuerpoJson, error, ok, paginacion } from "@/lib/api-publica/respuestas";

export async function GET(request: Request) {
  return conApi(request, "campanas:leer", async (ctx) => {
    const { limite, pagina, desde } = paginacion(new URL(request.url));
    const { data, count, error: err } = await ctx.admin
      .from("campaigns")
      .select(COLUMNAS_CAMPANA, { count: "exact" })
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at", { ascending: false })
      .range(desde, desde + limite - 1);
    if (err) return error("error_interno", "No se pudieron consultar las campañas.");
    return ok({ datos: (data ?? []).map((c) => campanaPublica(c as unknown as Parameters<typeof campanaPublica>[0])), pagina, limite, total: count ?? 0 });
  });
}

/**
 * Crea una campaña con plantilla. Queda en borrador, a menos que pidas
 * «enviar»: true (sale ya) o «programada_para» (sale a esa hora).
 */
export async function POST(request: Request) {
  return conApi(request, "campanas:escribir", async (ctx) => {
    const cuerpo = await cuerpoJson(request);
    if (!cuerpo) return error("peticion_invalida", "El cuerpo debe ser un objeto JSON.");
    const r = await crearCampanaApi(ctx.admin, ctx.workspaceId, cuerpo);
    if (!r.ok) return error(r.codigo, r.mensaje, r.extra);
    return ok({ campana: r.campana }, 201);
  });
}
