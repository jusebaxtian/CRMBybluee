import { conApi } from "@/lib/api-publica/autenticar";
import { conversacionPublica, COLUMNAS_CONVERSACION } from "@/lib/api-publica/conversaciones";
import { error, esUuid, ok, paginacion } from "@/lib/api-publica/respuestas";

/** Lista conversaciones, las de actividad más reciente primero. Filtros: estado (open|closed), contacto_id, linea_id. */
export async function GET(request: Request) {
  return conApi(request, "conversaciones:leer", async (ctx) => {
    const url = new URL(request.url);
    const { limite, pagina, desde } = paginacion(url);
    const estado = url.searchParams.get("estado");
    const contactoId = url.searchParams.get("contacto_id");
    const lineaId = url.searchParams.get("linea_id");

    let q = ctx.admin.from("conversations").select(COLUMNAS_CONVERSACION, { count: "exact" }).eq("workspace_id", ctx.workspaceId);
    if (estado) {
      if (estado !== "open" && estado !== "closed") return error("peticion_invalida", "«estado» debe ser open o closed.");
      q = q.eq("status", estado);
    }
    if (contactoId) {
      if (!esUuid(contactoId)) return error("peticion_invalida", "«contacto_id» no es válido.");
      q = q.eq("contact_id", contactoId);
    }
    if (lineaId) {
      if (!esUuid(lineaId)) return error("peticion_invalida", "«linea_id» no es válido.");
      q = q.eq("whatsapp_account_id", lineaId);
    }
    const { data, count, error: err } = await q.order("last_message_at", { ascending: false }).order("id").range(desde, desde + limite - 1);
    if (err) return error("error_interno", "No se pudieron consultar las conversaciones.");
    return ok({ datos: (data ?? []).map((c) => conversacionPublica(c as unknown as Parameters<typeof conversacionPublica>[0])), pagina, limite, total: count ?? 0 });
  });
}
