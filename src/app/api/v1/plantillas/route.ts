import { conApi } from "@/lib/api-publica/autenticar";
import { ok } from "@/lib/api-publica/respuestas";

/** Plantillas aprobadas, listas para enviar. */
export async function GET(request: Request) {
  return conApi(request, "plantillas:leer", async (ctx) => {
    const { data } = await ctx.admin
      .from("templates")
      .select("meta_template_name, language, category, body_text, variable_count, buttons, header_format, waba_id")
      .eq("workspace_id", ctx.workspaceId)
      .eq("status", "APPROVED")
      .order("meta_template_name");
    return ok({
      datos: (data ?? []).map((t) => ({
        nombre: t.meta_template_name,
        idioma: t.language,
        categoria: t.category,
        texto: t.body_text,
        variables: t.variable_count ?? 0,
        botones: t.buttons ?? [],
        encabezado: t.header_format,
        waba_id: t.waba_id,
      })),
    });
  });
}
