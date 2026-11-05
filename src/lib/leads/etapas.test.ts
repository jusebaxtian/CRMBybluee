import { describe, expect, it } from "vitest";
import { esEtapa, fechaDeEtapa } from "@/lib/leads/etapas";

describe("esEtapa", () => {
  it("acepta solo las cuatro etapas", () => {
    expect(esEtapa("pago")).toBe(true);
    expect(esEtapa("Pagó")).toBe(false);
    expect(esEtapa(null)).toBe(false);
  });
});

describe("fechaDeEtapa", () => {
  it("con fecha, muestra la fecha", () => {
    expect(fechaDeEtapa("tibio", "pago", "2026-11-03T00:00:00Z")).toEqual({ tipo: "fecha", fecha: "2026-11-03T00:00:00Z" });
  });
  it("la etapa actual sin fecha viene de una etiqueta vieja", () => {
    expect(fechaDeEtapa("pago", "pago", null)).toEqual({ tipo: "sin-fecha" });
  });
  it("otra etapa sin fecha no ocurrio o se salto", () => {
    expect(fechaDeEtapa("caliente", "tibio", null)).toEqual({ tipo: "sin-llegar" });
    expect(fechaDeEtapa("tibio", "caliente", null)).toEqual({ tipo: "sin-llegar" });
  });
});
