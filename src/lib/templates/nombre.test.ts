import { describe, it, expect } from "vitest";
import { normalizarNombrePlantilla } from "./nombre";

describe("normalizarNombrePlantilla — formato que exige Meta", () => {
  it("minusculas, sin tildes ni espacios", () => {
    expect(normalizarNombrePlantilla("Promoción Verano")).toBe("promocion_verano");
    expect(normalizarNombrePlantilla("Año Nuevo 2026!")).toBe("ano_nuevo_2026");
    expect(normalizarNombrePlantilla("  Recordatorio - pago  ", { final: true })).toBe("recordatorio_pago");
  });
  it("no deja guiones bajos repetidos ni al inicio", () => {
    expect(normalizarNombrePlantilla("__hola   mundo__")).toBe("hola_mundo_"); // al escribir, el _ final se conserva
    expect(normalizarNombrePlantilla("__hola   mundo__", { final: true })).toBe("hola_mundo");
    expect(normalizarNombrePlantilla("a  b")).toBe("a_b");
  });
  it("lo que ya es valido queda igual", () => {
    expect(normalizarNombrePlantilla("promo_verano_2")).toBe("promo_verano_2");
  });
});
