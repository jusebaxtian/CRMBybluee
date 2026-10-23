import { conApi } from "@/lib/api-publica/autenticar";
import { COLUMNAS_MENSAJE, mensajePublico } from "@/lib/api-publica/conversaciones";
import { error, esUuid, ok, paginacion } from "@/lib/api-publica/respuestas";

type Params = { params: Promise<{ id: string }> };

/** Historial de la conversación, del mensaje más reciente al más antiguo. */
export async function GET(request: Request, { params }: Params) {
  return conApi(request, "conversaciones:leer", async (ctx) => {
    const { id } = await params;
    if (!esUuid(id)) return error("no_encontrado", "No existe esa conversación.");
    const { data: conversacion } = await ctx.admin.from("conversations").select("id").eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle();
    if (!conversacion) return error("no_encontrado", "No existe esa conversación.");

    const { limite, pagina, desde } = paginacion(new URL(request.url));
    const { data, count, error: err } = await ctx.admin
      .from("messages")
      .select(COLUMNAS_MENSAJE, { count: "exact" })
      .eq("conversation_id", id)
      .order("created_at", { ascending: false })
      .order("id")
      .range(desde, desde + limite - 1);
    if (err) return error("error_interno", "No se pudieron consultar los mensajes.");
    return ok({ datos: (data ?? []).map((m) => mensajePublico(m as unknown as Parameters<typeof mensajePublico>[0])), pagina, limite, total: count ?? 0 });
  });
}
