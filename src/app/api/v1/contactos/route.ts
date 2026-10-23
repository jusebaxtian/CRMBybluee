import { conApi } from "@/lib/api-publica/autenticar";
import { COLUMNAS_CONTACTO, contactoPorTelefono, contactoPublico, telefonoValido, validarDatosContacto } from "@/lib/api-publica/contactos";
import { cuerpoJson, error, ok } from "@/lib/api-publica/respuestas";
import { mensajeDeErrorDeContactos } from "@/lib/billing/demo";

const MAX_POR_PAGINA = 100;

/** Lista y busca contactos. Filtros: telefono, q (nombre o numero), etiqueta; paginacion: pagina, limite. */
export async function GET(request: Request) {
  return conApi(request, "contactos:leer", async (ctx) => {
    const url = new URL(request.url);
    const limite = Math.min(MAX_POR_PAGINA, Math.max(1, Number(url.searchParams.get("limite")) || 50));
    const pagina = Math.max(1, Number(url.searchParams.get("pagina")) || 1);
    const telefono = url.searchParams.get("telefono");
    const q = (url.searchParams.get("q") ?? "").trim();
    const etiqueta = (url.searchParams.get("etiqueta") ?? "").trim();

    const columnas = etiqueta ? `${COLUMNAS_CONTACTO}, filtro:contact_tags!inner(tag_id)` : COLUMNAS_CONTACTO;
    let consulta = ctx.admin.from("contacts").select(columnas, { count: "exact" }).eq("workspace_id", ctx.workspaceId);

    if (telefono) {
      const normal = telefonoValido(telefono);
      if (!normal) return error("peticion_invalida", "«telefono» no es válido.");
      consulta = consulta.eq("wa_id", normal);
    }
    if (q) {
      // Los caracteres que tienen significado en el filtro se quitan, no se escapan.
      const limpio = q.replace(/[%,()*\\]/g, " ").trim();
      if (limpio) consulta = consulta.or(`name.ilike.%${limpio}%,wa_id.ilike.%${limpio.replace(/\D/g, "") || limpio}%`);
    }
    if (etiqueta) {
      const { data: tag } = await ctx.admin.from("tags").select("id").eq("workspace_id", ctx.workspaceId).eq("name", etiqueta).maybeSingle();
      if (!tag) return ok({ datos: [], pagina, limite, total: 0 });
      consulta = consulta.eq("filtro.tag_id", tag.id);
    }

    const desde = (pagina - 1) * limite;
    const { data, count, error: err } = await consulta.order("created_at", { ascending: false }).order("id").range(desde, desde + limite - 1);
    if (err) return error("error_interno", "No se pudieron consultar los contactos.");
    return ok({
      datos: (data ?? []).map((f) => contactoPublico(f as unknown as Parameters<typeof contactoPublico>[0])),
      pagina,
      limite,
      total: count ?? 0,
    });
  });
}

/** Crea el contacto, o actualiza sus datos si el telefono ya existe en tu cuenta. */
export async function POST(request: Request) {
  return conApi(request, "contactos:escribir", async (ctx) => {
    const cuerpo = await cuerpoJson(request);
    if (!cuerpo) return error("peticion_invalida", "El cuerpo debe ser un objeto JSON.");
    const telefono = telefonoValido(cuerpo.telefono);
    if (!telefono) return error("peticion_invalida", "Falta «telefono» o no es válido. Usa el número con código de país, por ejemplo 573001234567.");
    const datos = validarDatosContacto(cuerpo);
    if ("motivo" in datos) return error("peticion_invalida", datos.motivo);

    const r = await contactoPorTelefono(ctx.admin, ctx.workspaceId, telefono);
    if (!r.contacto) return error("conflicto", r.error ?? "No se pudo crear el contacto.");

    if (Object.keys(datos.columnas).length > 0) {
      const { error: err } = await ctx.admin.from("contacts").update(datos.columnas).eq("id", r.contacto.id).eq("workspace_id", ctx.workspaceId);
      if (err) return error("conflicto", mensajeDeErrorDeContactos(err.message));
    }
    const { data } = await ctx.admin.from("contacts").select(COLUMNAS_CONTACTO).eq("id", r.contacto.id).single();
    return ok({ contacto: contactoPublico(data as unknown as Parameters<typeof contactoPublico>[0]), creado: r.creado }, r.creado ? 201 : 200);
  });
}
