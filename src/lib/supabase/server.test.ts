import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, memoria } = vi.hoisted(() => ({
  getUser: vi.fn(async (jwt?: string) => ({ data: { user: { id: jwt ?? "de-la-sesion" } }, error: null })),
  memoria: new Map<unknown, unknown>(),
}));

// Lo que hace `cache` de React dentro de una carga: guarda la primera llamada.
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  cache: (fn: () => unknown) => () => {
    if (!memoria.has(fn)) memoria.set(fn, fn());
    return memoria.get(fn);
  },
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));
vi.mock("./config", () => ({ SUPABASE_SERVER_URL: "http://x", SUPABASE_ANON_KEY: "k", SUPABASE_COOKIE_NAME: "c" }));
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getUser } }) }));

import { createClient } from "./server";

describe("usuario por carga de página", () => {
  beforeEach(() => {
    getUser.mockClear();
    memoria.clear();
  });

  it("varios clientes en la misma carga consultan una sola vez", async () => {
    const respuestas = await Promise.all(
      [1, 2, 3].map(async () => (await createClient()).auth.getUser())
    );
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(respuestas.map((r) => r.data.user?.id)).toEqual(["de-la-sesion", "de-la-sesion", "de-la-sesion"]);
  });

  it("con un token explicito pregunta por ese token, sin guardarlo", async () => {
    const cliente = await createClient();
    const r = await cliente.auth.getUser("otro-token");
    expect(r.data.user?.id).toBe("otro-token");
    await cliente.auth.getUser("otro-token");
    expect(getUser).toHaveBeenCalledTimes(2);
  });

  it("una carga nueva vuelve a consultar", async () => {
    await (await createClient()).auth.getUser();
    memoria.clear();
    await (await createClient()).auth.getUser();
    expect(getUser).toHaveBeenCalledTimes(2);
  });
});
