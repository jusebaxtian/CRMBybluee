import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

import { descripcionParaGoogle } from "./calendario-del-equipo";

describe("descripcionParaGoogle", () => {
  it("agrega quien agendo al final", () => {
    expect(descripcionParaGoogle("Demo del CRM", "Santiago Toledo")).toBe("Demo del CRM\n\nAgendado por: Santiago Toledo");
  });
  it("sin descripcion queda solo quien agendo", () => {
    expect(descripcionParaGoogle("  ", "Santiago Toledo")).toBe("Agendado por: Santiago Toledo");
  });
  it("sin nombre deja la descripcion como estaba", () => {
    expect(descripcionParaGoogle("Demo", null)).toBe("Demo");
    expect(descripcionParaGoogle(null, null)).toBeNull();
  });
});
