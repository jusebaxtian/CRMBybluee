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

describe("semaforoDeUso", () => {
  it("verde si envio mensajes en los ultimos 7 dias", async () => {
    const { semaforoDeUso } = await import("@/lib/fidelidad/clientes-por-estado");
    expect(semaforoDeUso(12, "2026-11-21T10:00:00Z")).toBe("verde");
  });
  it("amarillo si envio alguna vez pero no esta semana", async () => {
    const { semaforoDeUso } = await import("@/lib/fidelidad/clientes-por-estado");
    expect(semaforoDeUso(0, "2026-10-01T10:00:00Z")).toBe("amarillo");
  });
  it("rojo si nunca envio", async () => {
    const { semaforoDeUso } = await import("@/lib/fidelidad/clientes-por-estado");
    expect(semaforoDeUso(0, null)).toBe("rojo");
  });
});
