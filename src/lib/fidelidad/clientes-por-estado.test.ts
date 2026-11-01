import { describe, expect, it } from "vitest";
import { clasificar } from "@/lib/fidelidad/clientes-por-estado";

const ahora = new Date("2026-11-01T15:00:00Z");
const enDias = (d: number) => new Date(ahora.getTime() + d * 86_400_000).toISOString();

describe("clasificar cliente", () => {
  it("activo con mas de 7 dias", () => expect(clasificar("active", enDias(20), ahora)).toBe("activos"));
  it("activo con 7 dias o menos esta por vencer", () => {
    expect(clasificar("active", enDias(7), ahora)).toBe("porVencer");
    expect(clasificar("active", enDias(1), ahora)).toBe("porVencer");
  });
  it("activo con la fecha ya pasada esta vencido", () => expect(clasificar("active", enDias(-1), ahora)).toBe("vencidos"));
  it("past_due y canceled estan vencidos aunque la fecha sea futura", () => {
    expect(clasificar("past_due", enDias(10), ahora)).toBe("vencidos");
    expect(clasificar("canceled", null, ahora)).toBe("vencidos");
  });
  it("activo sin fecha cuenta como activo", () => expect(clasificar("active", null, ahora)).toBe("activos"));
});
