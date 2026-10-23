import { conApi } from "@/lib/api-publica/autenticar";
import { ok } from "@/lib/api-publica/respuestas";

/** Lineas de WhatsApp conectadas; su «id» es el «linea_id» al enviar. */
export async function GET(request: Request) {
  return conApi(request, "lineas:leer", async (ctx) => {
    const { data } = await ctx.admin
      .from("whatsapp_accounts")
      .select("id, display_phone_number, label, waba_id")
      .eq("workspace_id", ctx.workspaceId)
      .neq("status", "frozen")
      .order("connected_at");
    return ok({
      datos: (data ?? []).map((l) => ({ id: l.id, telefono: l.display_phone_number, nombre: l.label, waba_id: l.waba_id })),
    });
  });
}
