import { conApi } from "@/lib/api-publica/autenticar";
import { startCampaignSend } from "@/lib/campaigns/send";
import { error, esUuid, ok } from "@/lib/api-publica/respuestas";

type Params = { params: Promise<{ id: string }> };

/** Lanza una campaña que quedó en borrador. El envío sigue en segundo plano: consulta el avance con GET /campanas/{id}. */
export async function POST(request: Request, { params }: Params) {
  return conApi(request, "campanas:escribir", async (ctx) => {
    const { id } = await params;
    if (!esUuid(id)) return error("no_encontrado", "No existe esa campaña.");
    const { data } = await ctx.admin.from("campaigns").select("id, status").eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle();
    if (!data) return error("no_encontrado", "No existe esa campaña.");
    if (data.status !== "draft") return error("conflicto", "Solo se pueden lanzar campañas en borrador.");

    const r = await startCampaignSend(ctx.admin, ctx.workspaceId, id);
    if ("error" in r) return error("conflicto", r.error);
    return ok({ campana: { id, estado: "enviando" } }, 202);
  });
}
