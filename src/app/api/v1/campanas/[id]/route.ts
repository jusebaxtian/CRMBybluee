import { conApi } from "@/lib/api-publica/autenticar";
import { COLUMNAS_CAMPANA, campanaPublica } from "@/lib/api-publica/campanas";
import { error, esUuid, ok } from "@/lib/api-publica/respuestas";

type Params = { params: Promise<{ id: string }> };

const ESTADOS = ["pending", "sent", "delivered", "read", "failed"] as const;
const NOMBRES: Record<(typeof ESTADOS)[number], string> = { pending: "pendientes", sent: "enviados", delivered: "entregados", read: "leidos", failed: "fallidos" };

/** La campaña y su resultado: cuántos destinatarios van en cada estado. */
export async function GET(request: Request, { params }: Params) {
  return conApi(request, "campanas:leer", async (ctx) => {
    const { id } = await params;
    if (!esUuid(id)) return error("no_encontrado", "No existe esa campaña.");
    const { data } = await ctx.admin.from("campaigns").select(COLUMNAS_CAMPANA).eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle();
    if (!data) return error("no_encontrado", "No existe esa campaña.");

    const conteos = await Promise.all(
      ESTADOS.map((estado) =>
        ctx.admin.from("campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", id).eq("status", estado)
      )
    );
    const resultado: Record<string, number> = {};
    let total = 0;
    ESTADOS.forEach((estado, i) => {
      const n = conteos[i].count ?? 0;
      resultado[NOMBRES[estado]] = n;
      total += n;
    });
    return ok({ campana: { ...campanaPublica(data as unknown as Parameters<typeof campanaPublica>[0]), destinatarios: total, resultado } });
  });
}
