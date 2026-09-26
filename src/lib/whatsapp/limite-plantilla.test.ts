import { describe, it, expect } from "vitest";
import {
  largoFijo,
  variablesDe,
  espacioPorVariable,
  noSePuedeUsar,
  quedaJusto,
  margenRestante,
} from "@/lib/whatsapp/limite-plantilla";

// Los cuerpos reales de produccion, resumidos a su largo: lo que importa de
// una plantilla para este limite es cuanto ocupa su texto fijo.
const cuerpoDe = (fijo: number) => "Hola Sr. {{1}}" + "x".repeat(fijo - 9);

describe("limite de plantilla", () => {
  it("mide el texto fijo sin los marcadores", () => {
    expect(largoFijo("Hola {{1}}!")).toBe(6);
    expect(variablesDe("Hola {{1}}, {{2}} y {{1}}")).toEqual(["{{1}}", "{{2}}"]);
  });

  it("bloquea las que no dejan espacio ni para un nombre corriente", () => {
    // colpensiones_geo_pichincha: 1016 de texto fijo, fallo 181 de 181.
    expect(noSePuedeUsar(cuerpoDe(1016))).toBe(true);
    // cremil_geo_pichi: 1009, los nombres de 16 caracteres fallaban.
    expect(noSePuedeUsar(cuerpoDe(1009))).toBe(true);
    expect(espacioPorVariable(cuerpoDe(1009))).toBe(15);
  });

  it("no bloquea las que hoy envian bien, solo las marca justas", () => {
    // marisol_cremil_pichincha: 990, envia bien con los nombres reales.
    expect(noSePuedeUsar(cuerpoDe(990))).toBe(false);
    expect(quedaJusto(cuerpoDe(990))).toBe(true);
    expect(espacioPorVariable(cuerpoDe(990))).toBe(34);
  });

  it("deja en paz una plantilla normal", () => {
    const normal = "Hola {{1}}, tenemos una promoción para ti.";
    expect(noSePuedeUsar(normal)).toBe(false);
    expect(quedaJusto(normal)).toBe(false);
    expect(margenRestante(normal)).toBeGreaterThan(0);
  });

  it("tambien mide las que no tienen variables", () => {
    expect(noSePuedeUsar("y".repeat(1030))).toBe(true);
    expect(noSePuedeUsar("y".repeat(1000))).toBe(false);
    expect(noSePuedeUsar(null)).toBe(false);
  });
});
