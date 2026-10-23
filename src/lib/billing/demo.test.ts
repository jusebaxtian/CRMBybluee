import { describe, it, expect } from "vitest";
import { DIAS_DEMO, diasDemoValidos, mensajeDeErrorDeContactos, mensajeDeTopeDeEnvios } from "@/lib/billing/demo";

describe("duracion del demo", () => {
  it("solo 3, 4, 5 o 7 dias", () => {
    expect([...DIAS_DEMO]).toEqual([3, 4, 5, 7]);
    for (const d of [3, 4, 5, 7]) expect(diasDemoValidos(d)).toBe(true);
    for (const d of [0, 1, 2, 6, 8, 30, 365, 3.5]) expect(diasDemoValidos(d)).toBe(false);
  });
});

describe("mensajeDeErrorDeContactos", () => {
  it("traduce el error del tope de contactos", () => {
    expect(mensajeDeErrorDeContactos("DEMO_LIMITE_CONTACTOS:100")).toContain("hasta 100 contactos");
    expect(mensajeDeErrorDeContactos("DEMO_LIMITE_CONTACTOS:100")).toContain("Activa un plan");
  });
  it("deja pasar cualquier otro error", () => {
    expect(mensajeDeErrorDeContactos("duplicate key value")).toBe("duplicate key value");
  });
});

describe("mensajeDeTopeDeEnvios", () => {
  it("sin tope, siempre cabe", () => {
    expect(mensajeDeTopeDeEnvios(null, 5000, 5000)).toBeNull();
  });
  it("cabe justo en lo que queda", () => {
    expect(mensajeDeTopeDeEnvios(100, 60, 40)).toBeNull();
  });
  it("si pasa de lo que queda, dice cuanto queda", () => {
    const m = mensajeDeTopeDeEnvios(100, 60, 41);
    expect(m).toContain("te quedan 40");
    expect(m).toContain("41 destinatarios");
  });
  it("si ya se usaron todos, lo dice", () => {
    expect(mensajeDeTopeDeEnvios(100, 100, 1)).toContain("ya los usaste");
    expect(mensajeDeTopeDeEnvios(100, 130, 1)).toContain("ya los usaste");
  });
});
