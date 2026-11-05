import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/config", () => ({ SUPABASE_SERVER_URL: "http://127.0.0.1:1" }));

import { createAdminClient } from "@/lib/supabase/admin";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("createAdminClient", () => {
  it("no deja temporizadores corriendo en el servidor (fuga de memoria)", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "llave-de-prueba");
    const intervalo = vi.spyOn(globalThis, "setInterval");
    const cliente = createAdminClient();
    await (cliente.auth as unknown as { initializePromise: Promise<unknown> }).initializePromise;
    expect(intervalo).not.toHaveBeenCalled();
  });
});
