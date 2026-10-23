import { describe, it, expect } from "vitest";
import { executeAction, type AutomationAction } from "@/lib/automations/engine";

/**
 * Doble de Supabase que anota lo que se le pide. Cada consulta devuelve
 * `{ error }` al esperarla, como lo haria el cliente real.
 */
function fakeSupabase(error: { message: string } | null = null) {
  const llamadas: { tabla: string; operacion: string; filtros: Record<string, unknown>; datos?: unknown }[] = [];
  const supabase = {
    from(tabla: string) {
      const actual = { tabla, operacion: "select", filtros: {} as Record<string, unknown>, datos: undefined as unknown };
      const cadena: Record<string, unknown> = {
        select: () => cadena,
        delete: () => ((actual.operacion = "delete"), cadena),
        upsert: (datos: unknown) => ((actual.operacion = "upsert"), (actual.datos = datos), cadena),
        eq: (col: string, val: unknown) => ((actual.filtros[col] = val), cadena),
        maybeSingle: async () => ({ data: null, error: null }),
        single: async () => ({ data: null, error: null }),
        then: (resolver: (v: unknown) => unknown) => {
          llamadas.push({ ...actual });
          return Promise.resolve({ data: null, error }).then(resolver);
        },
      };
      return cadena;
    },
  };
  return { supabase: supabase as unknown as Parameters<typeof executeAction>[0], llamadas };
}

const automatizacion = { id: "a1", workspace_id: "w1" };
const accion = (extra: Partial<AutomationAction>): AutomationAction => ({
  position: 0,
  action_type: "remove_tag",
  message_body: null,
  tag_id: null,
  media_url: null,
  media_filename: null,
  template_id: null,
  quick_reply_id: null,
  delay_seconds: 0,
  target_agent_id: null,
  agent_distribution: null,
  buttons: null,
  templates: null,
  ...extra,
});

describe("acción Quitar etiqueta", () => {
  it("borra la etiqueta de ese contacto, y solo esa", async () => {
    const { supabase, llamadas } = fakeSupabase();
    await executeAction(supabase, automatizacion, "contacto-1", accion({ action_type: "remove_tag", tag_id: "tag-9" }));
    const borrados = llamadas.filter((l) => l.operacion === "delete");
    expect(borrados).toHaveLength(1);
    expect(borrados[0]).toMatchObject({ tabla: "contact_tags", filtros: { contact_id: "contacto-1", tag_id: "tag-9" } });
  });

  it("si la base falla, avisa en vez de dar la acción por buena", async () => {
    const { supabase } = fakeSupabase({ message: "boom" });
    await expect(
      executeAction(supabase, automatizacion, "contacto-1", accion({ action_type: "remove_tag", tag_id: "tag-9" }))
    ).rejects.toThrow("No se pudo quitar la etiqueta: boom");
  });

  it("sin etiqueta elegida no borra nada", async () => {
    const { supabase, llamadas } = fakeSupabase();
    await executeAction(supabase, automatizacion, "contacto-1", accion({ action_type: "remove_tag", tag_id: null }));
    expect(llamadas.filter((l) => l.operacion === "delete")).toHaveLength(0);
  });

  it("agregar etiqueta sigue funcionando igual: inserta y no borra", async () => {
    const { supabase, llamadas } = fakeSupabase();
    await executeAction(supabase, automatizacion, "contacto-1", accion({ action_type: "add_tag", tag_id: "tag-9" }));
    expect(llamadas.some((l) => l.operacion === "upsert" && l.tabla === "contact_tags")).toBe(true);
    expect(llamadas.some((l) => l.operacion === "delete")).toBe(false);
  });
});
