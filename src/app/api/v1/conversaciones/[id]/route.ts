import { conApi } from "@/lib/api-publica/autenticar";
import { COLUMNAS_CONVERSACION, conversacionPublica } from "@/lib/api-publica/conversaciones";
import { cuerpoJson, error, esUuid, ok } from "@/lib/api-publica/respuestas";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  return conApi(request, "conversaciones:leer", async (ctx) => {
    const { id } = await params;
    if (!esUuid(id)) return error("no_encontrado", "No existe esa conversación.");
    const { data } = await ctx.admin.from("conversations").select(COLUMNAS_CONVERSACION).eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle();
    if (!data) return error("no_encontrado", "No existe esa conversación.");
    return ok({ conversacion: conversacionPublica(data as unknown as Parameters<typeof conversacionPublica>[0]) });
  });
}

/** Cierra o reabre la conversación («estado»: open | closed) y/o la asigna a un agente («agente_id», o null para quitarla). */
export async function PATCH(request: Request, { params }: Params) {
  return conApi(request, "conversaciones:escribir", async (ctx) => {
    const { id } = await params;
    if (!esUuid(id)) return error("no_encontrado", "No existe esa conversación.");
    const cuerpo = await cuerpoJson(request);
    if (!cuerpo) return error("peticion_invalida", "El cuerpo debe ser un objeto JSON.");

    const cambios: Record<string, unknown> = {};
    if ("estado" in cuerpo) {
      if (cuerpo.estado !== "open" && cuerpo.estado !== "closed") return error("peticion_invalida", "«estado» debe ser open o closed.");
      cambios.status = cuerpo.estado;
    }
    if ("agente_id" in cuerpo) {
      if (cuerpo.agente_id === null) {
        cambios.assigned_agent_id = null;
      } else if (typeof cuerpo.agente_id === "string" && esUuid(cuerpo.agente_id)) {
        const { data: miembro } = await ctx.admin
          .from("workspace_members")
          .select("user_id")
          .eq("workspace_id", ctx.workspaceId)
          .eq("user_id", cuerpo.agente_id)
          .maybeSingle();
        if (!miembro) return error("peticion_invalida", "Ese «agente_id» no pertenece a tu cuenta.");
        cambios.assigned_agent_id = cuerpo.agente_id;
      } else {
        return error("peticion_invalida", "«agente_id» debe ser el id de un agente o null.");
      }
    }
    if (Object.keys(cambios).length === 0) return error("peticion_invalida", "No enviaste ningún campo para cambiar («estado» o «agente_id»).");

    const { data: existente } = await ctx.admin.from("conversations").select("id").eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle();
    if (!existente) return error("no_encontrado", "No existe esa conversación.");
    const { error: err } = await ctx.admin.from("conversations").update(cambios).eq("id", id).eq("workspace_id", ctx.workspaceId);
    if (err) return error("error_interno", "No se pudo actualizar la conversación.");

    const { data } = await ctx.admin.from("conversations").select(COLUMNAS_CONVERSACION).eq("id", id).single();
    return ok({ conversacion: conversacionPublica(data as unknown as Parameters<typeof conversacionPublica>[0]) });
  });
}
