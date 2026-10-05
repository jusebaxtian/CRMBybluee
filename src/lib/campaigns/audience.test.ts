import { describe, it, expect } from "vitest";
import { resolveCampaignAudience } from "@/lib/campaigns/audience";

const PARAMS = { includeTagIds: ["t1"], excludeTagIds: [], createdFromRaw: null, createdToRaw: null };

// La consulta de la base entrega las filas por paginas con .range().
function fakeSupabase(filas: { contact_id: string; has_open_window: boolean }[]) {
  return {
    rpc: () => ({
      range: async (desde: number, hasta: number) => ({ data: filas.slice(desde, hasta + 1), error: null }),
    }),
  } as never;
}

/**
 * El 5 oct 2026, en citytours: dos contactos, uno de ellos con una conversacion
 * por cada una de las 3 lineas. La audiencia salia con 4 filas, la vista previa
 * decia 4 y al guardar Postgres rechazaba el lote entero (unique campaign_id,
 * contact_id): la campaña quedaba vacia.
 */
describe("resolveCampaignAudience", () => {
  const FILAS = [
    { contact_id: "a", has_open_window: false },
    { contact_id: "b", has_open_window: true },
    { contact_id: "b", has_open_window: false },
    { contact_id: "b", has_open_window: false },
  ];

  it("un contacto con varias conversaciones cuenta una sola vez", async () => {
    const r = await resolveCampaignAudience(fakeSupabase(FILAS), "ws", { ...PARAMS, audienceWindow: "all" });
    expect(r.contactIds.sort()).toEqual(["a", "b"]);
    expect(r.matchedBeforeWindow).toBe(2);
  });

  it("la ventana esta abierta si lo esta en cualquiera de sus conversaciones", async () => {
    const r = await resolveCampaignAudience(fakeSupabase(FILAS), "ws", { ...PARAMS, audienceWindow: "open" });
    expect(r.contactIds).toEqual(["b"]);
    expect(r.matchedBeforeWindow).toBe(2);
  });

  it("pasadas de 1.000 filas sigue sin repetir contactos", async () => {
    const muchas = Array.from({ length: 1500 }, (_, i) => ({ contact_id: `c${i % 1200}`, has_open_window: false }));
    const r = await resolveCampaignAudience(fakeSupabase(muchas), "ws", { ...PARAMS, audienceWindow: "all" });
    expect(r.contactIds.length).toBe(1200);
    expect(new Set(r.contactIds).size).toBe(1200);
  });
});
