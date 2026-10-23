import { conApi } from "@/lib/api-publica/autenticar";
import { cuerpoJson, error, esUuid, ok } from "@/lib/api-publica/respuestas";
import { iniciarPorEtiqueta } from "@/lib/flujos/motor";
import { runTagAddedAutomations } from "@/lib/automations/engine";
import { maybeTrackPurchaseFromTag } from "@/lib/meta/conversions";

type Params = { params: Promise<{ id: string }> };

/**
 * Pone una etiqueta al contacto (se crea si no existe). Hace lo mismo que
 * etiquetar desde el CRM: puede arrancar un flujo o una automatizacion que
 * dependa de esa etiqueta.
 */
export async function POST(request: Request, { params }: Params) {
  return conApi(request, "etiquetas:escribir", async (ctx) => {
    const { id } = await params;
    if (!esUuid(id)) return error("no_encontrado", "No existe ese contacto.");
    const cuerpo = await cuerpoJson(request);
    const nombre = typeof cuerpo?.etiqueta === "string" ? cuerpo.etiqueta.trim() : "";
    if (!nombre || nombre.length > 60) return error("peticion_invalida", "«etiqueta» es obligatoria (el nombre, hasta 60 caracteres).");

    const { data: contacto } = await ctx.admin.from("contacts").select("id").eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle();
    if (!contacto) return error("no_encontrado", "No existe ese contacto.");

    let { data: tag } = await ctx.admin.from("tags").select("id").eq("workspace_id", ctx.workspaceId).eq("name", nombre).maybeSingle();
    if (!tag) {
      const { data: nueva } = await ctx.admin.from("tags").insert({ workspace_id: ctx.workspaceId, name: nombre, color: "#1ba84a" }).select("id").single();
      tag = nueva ?? (await ctx.admin.from("tags").select("id").eq("workspace_id", ctx.workspaceId).eq("name", nombre).maybeSingle()).data;
    }
    if (!tag) return error("error_interno", "No se pudo crear la etiqueta.");

    const { data: ya } = await ctx.admin.from("contact_tags").select("tag_id").eq("contact_id", id).eq("tag_id", tag.id).maybeSingle();
    if (ya) return ok({ asignada: false, etiqueta: nombre, motivo: "El contacto ya tenía esa etiqueta." });

    const { error: err } = await ctx.admin.from("contact_tags").insert({ contact_id: id, tag_id: tag.id });
    if (err) return error("error_interno", "No se pudo asignar la etiqueta.");

    // Mismas consecuencias que etiquetar desde el CRM; un fallo aqui no deshace la etiqueta.
    try {
      const loTomoUnFlujo = await iniciarPorEtiqueta(ctx.admin, ctx.workspaceId, id, tag.id);
      if (!loTomoUnFlujo) await runTagAddedAutomations(ctx.admin, ctx.workspaceId, id, tag.id);
      await maybeTrackPurchaseFromTag(ctx.admin, ctx.workspaceId, id, tag.id);
    } catch (e) {
      console.error("api publica: efectos de la etiqueta:", e instanceof Error ? e.message : e);
    }
    return ok({ asignada: true, etiqueta: nombre }, 201);
  });
}
