import { conApi } from "@/lib/api-publica/autenticar";
import { enviarMensajeApi } from "@/lib/api-publica/enviar";
import { cuerpoJson, error, ok } from "@/lib/api-publica/respuestas";

/**
 * Envia un mensaje de texto (dentro de las 24 horas) o una plantilla aprobada.
 * El destinatario va por «telefono» (se crea el contacto si no existe) o «contacto_id».
 */
export async function POST(request: Request) {
  return conApi(request, "mensajes:enviar", async (ctx) => {
    const cuerpo = await cuerpoJson(request);
    if (!cuerpo) return error("peticion_invalida", "El cuerpo debe ser un objeto JSON.");
    const r = await enviarMensajeApi(ctx.admin, ctx.workspaceId, cuerpo);
    if (!r.ok) return error(r.codigo, r.mensaje, r.extra);
    return ok({ mensaje: r.datos }, 201);
  });
}
