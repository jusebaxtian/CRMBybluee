import { conApi } from "@/lib/api-publica/autenticar";
import { error, esUuid, ok } from "@/lib/api-publica/respuestas";

type Params = { params: Promise<{ id: string; nombre: string }> };

/** Quita una etiqueta del contacto (el nombre va codificado en la URL). */
export async function DELETE(request: Request, { params }: Params) {
  return conApi(request, "etiquetas:escribir", async (ctx) => {
    const { id, nombre } = await params;
    if (!esUuid(id)) return error("no_encontrado", "No existe ese contacto.");
    const etiqueta = decodeURIComponent(nombre).trim();

    const { data: contacto } = await ctx.admin.from("contacts").select("id").eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle();
    if (!contacto) return error("no_encontrado", "No existe ese contacto.");
    const { data: tag } = await ctx.admin.from("tags").select("id").eq("workspace_id", ctx.workspaceId).eq("name", etiqueta).maybeSingle();
    if (!tag) return error("no_encontrado", "No existe esa etiqueta.");

    await ctx.admin.from("contact_tags").delete().eq("contact_id", id).eq("tag_id", tag.id);
    return ok({ quitada: true, etiqueta });
  });
}
