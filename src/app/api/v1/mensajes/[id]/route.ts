import { conApi } from "@/lib/api-publica/autenticar";
import { error, ok } from "@/lib/api-publica/respuestas";

type Params = { params: Promise<{ id: string }> };

/** Estado de un mensaje enviado: sent, delivered, read o failed. El «id» es el que devolvio el envio. */
export async function GET(request: Request, { params }: Params) {
  return conApi(request, "mensajes:leer", async (ctx) => {
    const { id } = await params;
    const { data } = await ctx.admin
      .from("messages")
      .select("wa_message_id, status, error_detail, message_type, created_at, conversation_id, conversations!inner(workspace_id, contact_id)")
      .eq("wa_message_id", id)
      .eq("direction", "out")
      .eq("conversations.workspace_id", ctx.workspaceId)
      .maybeSingle();
    if (!data) return error("no_encontrado", "No existe un mensaje enviado con ese id.");
    const conversacion = data.conversations as unknown as { contact_id: string };
    return ok({
      mensaje: {
        id: data.wa_message_id,
        estado: data.status,
        error: data.error_detail,
        tipo: data.message_type === "template" ? "plantilla" : data.message_type,
        contacto_id: conversacion.contact_id,
        conversacion_id: data.conversation_id,
        creado_el: data.created_at,
      },
    });
  });
}
