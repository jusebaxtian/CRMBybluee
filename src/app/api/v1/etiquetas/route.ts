import { conApi } from "@/lib/api-publica/autenticar";
import { cuerpoJson, error, ok } from "@/lib/api-publica/respuestas";

const COLOR = /^#[0-9a-fA-F]{6}$/;

export async function GET(request: Request) {
  return conApi(request, "etiquetas:leer", async (ctx) => {
    const { data } = await ctx.admin.from("tags").select("id, name, color").eq("workspace_id", ctx.workspaceId).order("name");
    return ok({ datos: (data ?? []).map((t) => ({ id: t.id, nombre: t.name, color: t.color })) });
  });
}

/** Crea una etiqueta. Si ya existe una con ese nombre responde 409. */
export async function POST(request: Request) {
  return conApi(request, "etiquetas:escribir", async (ctx) => {
    const cuerpo = await cuerpoJson(request);
    if (!cuerpo) return error("peticion_invalida", "El cuerpo debe ser un objeto JSON.");
    const nombre = typeof cuerpo.nombre === "string" ? cuerpo.nombre.trim() : "";
    if (!nombre || nombre.length > 60) return error("peticion_invalida", "«nombre» es obligatorio (hasta 60 caracteres).");
    const color = cuerpo.color === undefined ? "#1ba84a" : cuerpo.color;
    if (typeof color !== "string" || !COLOR.test(color)) return error("peticion_invalida", "«color» debe ser un color hexadecimal, por ejemplo #1ba84a.");

    const { data, error: err } = await ctx.admin.from("tags").insert({ workspace_id: ctx.workspaceId, name: nombre, color }).select("id, name, color").single();
    if (err || !data) {
      return error(err?.code === "23505" ? "conflicto" : "error_interno", err?.code === "23505" ? "Ya existe una etiqueta con ese nombre." : "No se pudo crear la etiqueta.");
    }
    return ok({ etiqueta: { id: data.id, nombre: data.name, color: data.color } }, 201);
  });
}
