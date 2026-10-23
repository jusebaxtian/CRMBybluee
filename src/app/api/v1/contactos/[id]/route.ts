import { conApi } from "@/lib/api-publica/autenticar";
import { COLUMNAS_CONTACTO, contactoPublico, telefonoValido, validarDatosContacto } from "@/lib/api-publica/contactos";
import { cuerpoJson, error, ok } from "@/lib/api-publica/respuestas";

type Params = { params: Promise<{ id: string }> };

const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request, { params }: Params) {
  return conApi(request, "contactos:leer", async (ctx) => {
    const { id } = await params;
    if (!ES_UUID.test(id)) return error("no_encontrado", "No existe ese contacto.");
    const { data } = await ctx.admin.from("contacts").select(COLUMNAS_CONTACTO).eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle();
    if (!data) return error("no_encontrado", "No existe ese contacto.");
    return ok({ contacto: contactoPublico(data as unknown as Parameters<typeof contactoPublico>[0]) });
  });
}

/** Borra el contacto con sus conversaciones y mensajes. No se puede deshacer. */
export async function DELETE(request: Request, { params }: Params) {
  return conApi(request, "contactos:eliminar", async (ctx) => {
    const { id } = await params;
    if (!ES_UUID.test(id)) return error("no_encontrado", "No existe ese contacto.");
    const { data } = await ctx.admin.from("contacts").delete().eq("id", id).eq("workspace_id", ctx.workspaceId).select("id");
    if (!data || data.length === 0) return error("no_encontrado", "No existe ese contacto.");
    return ok({ eliminado: true, id });
  });
}

/** Edita nombre, notas, variable2-4 y, si se quiere, el telefono. Solo cambia lo que se envia. */
export async function PATCH(request: Request, { params }: Params) {
  return conApi(request, "contactos:escribir", async (ctx) => {
    const { id } = await params;
    if (!ES_UUID.test(id)) return error("no_encontrado", "No existe ese contacto.");
    const cuerpo = await cuerpoJson(request);
    if (!cuerpo) return error("peticion_invalida", "El cuerpo debe ser un objeto JSON.");
    const datos = validarDatosContacto(cuerpo);
    if ("motivo" in datos) return error("peticion_invalida", datos.motivo);
    const columnas = datos.columnas;
    if ("telefono" in cuerpo) {
      const telefono = telefonoValido(cuerpo.telefono);
      if (!telefono) return error("peticion_invalida", "«telefono» no es válido.");
      columnas.wa_id = telefono;
    }
    if (Object.keys(columnas).length === 0) return error("peticion_invalida", "No enviaste ningún campo para cambiar.");

    const { data: existente } = await ctx.admin.from("contacts").select("id").eq("id", id).eq("workspace_id", ctx.workspaceId).maybeSingle();
    if (!existente) return error("no_encontrado", "No existe ese contacto.");

    const { error: err } = await ctx.admin.from("contacts").update(columnas).eq("id", id).eq("workspace_id", ctx.workspaceId);
    if (err) {
      return error("conflicto", err.code === "23505" ? "Ya existe otro contacto con ese teléfono en tu cuenta." : "No se pudo actualizar el contacto.");
    }
    const { data } = await ctx.admin.from("contacts").select(COLUMNAS_CONTACTO).eq("id", id).single();
    return ok({ contacto: contactoPublico(data as unknown as Parameters<typeof contactoPublico>[0]) });
  });
}
