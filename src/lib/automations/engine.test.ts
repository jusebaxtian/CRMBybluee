import { describe, it, expect } from "vitest";
import { isContactExcludedFromAutomations } from "@/lib/automations/engine";

/**
 * Doble de Supabase para las tres consultas que hace la exclusion:
 *  - conversations.followups_enabled  (maybeSingle)
 *  - contacts.likely_blocked          (maybeSingle)
 *  - contact_tags -> tags(excludes_followups)  (lista, se resuelve al await)
 *
 * La cadena es "thenable" para que `await supabase.from(...).select(...).eq(...)`
 * resuelva sin llamar a maybeSingle, que es como consulta las etiquetas.
 */
function fakeSupabase(estado: {
  conversacion?: { followups_enabled: boolean } | null;
  contacto?: { likely_blocked: boolean } | null;
  etiquetas?: { tags: { excludes_followups: boolean } | null }[];
}) {
  return {
    from(tabla: string) {
      const resultadoLista = { data: estado.etiquetas ?? [] };
      const resultadoUnico = {
        data:
          tabla === "conversations"
            ? estado.conversacion ?? null
            : tabla === "contacts"
              ? estado.contacto ?? null
              : null,
      };
      const constructor: Record<string, unknown> = {
        select: () => constructor,
        eq: () => constructor,
        maybeSingle: async () => resultadoUnico,
        then: (resolver: (v: unknown) => unknown) => Promise.resolve(resultadoLista).then(resolver),
      };
      return constructor;
    },
  } as unknown as Parameters<typeof isContactExcludedFromAutomations>[0];
}

// Esta funcion corta ANTES de comparar disparadores: si devuelve true, el
// contacto queda fuera de todas las automatizaciones, del agente de IA y de
// los seguimientos. Un cliente real perdio quince automatizaciones de boton
// porque su etiqueta "prospecto" tenia esta marca puesta.
describe("isContactExcludedFromAutomations — el corte que apaga todo", () => {
  it("no excluye a un contacto normal", async () => {
    const supabase = fakeSupabase({
      conversacion: { followups_enabled: true },
      contacto: { likely_blocked: false },
      etiquetas: [{ tags: { excludes_followups: false } }],
    });
    await expect(isContactExcludedFromAutomations(supabase, "c1")).resolves.toBe(false);
  });

  it("excluye si la conversacion tiene los seguimientos apagados", async () => {
    const supabase = fakeSupabase({
      conversacion: { followups_enabled: false },
      contacto: { likely_blocked: false },
      etiquetas: [],
    });
    await expect(isContactExcludedFromAutomations(supabase, "c1")).resolves.toBe(true);
  });

  it("excluye si el contacto figura como posible bloqueo", async () => {
    const supabase = fakeSupabase({
      conversacion: { followups_enabled: true },
      contacto: { likely_blocked: true },
      etiquetas: [],
    });
    await expect(isContactExcludedFromAutomations(supabase, "c1")).resolves.toBe(true);
  });

  it("excluye si CUALQUIERA de sus etiquetas lleva la marca", async () => {
    const supabase = fakeSupabase({
      conversacion: { followups_enabled: true },
      contacto: { likely_blocked: false },
      etiquetas: [
        { tags: { excludes_followups: false } },
        { tags: { excludes_followups: true } }, // basta una
        { tags: { excludes_followups: false } },
      ],
    });
    await expect(isContactExcludedFromAutomations(supabase, "c1")).resolves.toBe(true);
  });

  it("no excluye cuando ninguna etiqueta lleva la marca", async () => {
    const supabase = fakeSupabase({
      conversacion: { followups_enabled: true },
      contacto: { likely_blocked: false },
      etiquetas: [
        { tags: { excludes_followups: false } },
        { tags: { excludes_followups: false } },
      ],
    });
    await expect(isContactExcludedFromAutomations(supabase, "c1")).resolves.toBe(false);
  });

  it("no excluye a un contacto sin etiquetas", async () => {
    const supabase = fakeSupabase({
      conversacion: { followups_enabled: true },
      contacto: { likely_blocked: false },
      etiquetas: [],
    });
    await expect(isContactExcludedFromAutomations(supabase, "c1")).resolves.toBe(false);
  });

  it("tolera una etiqueta cuya relacion vino nula", async () => {
    const supabase = fakeSupabase({
      conversacion: { followups_enabled: true },
      contacto: { likely_blocked: false },
      etiquetas: [{ tags: null }],
    });
    await expect(isContactExcludedFromAutomations(supabase, "c1")).resolves.toBe(false);
  });

  it("no excluye si el contacto aun no tiene conversacion", async () => {
    const supabase = fakeSupabase({
      conversacion: null,
      contacto: { likely_blocked: false },
      etiquetas: [],
    });
    await expect(isContactExcludedFromAutomations(supabase, "c1")).resolves.toBe(false);
  });
});
