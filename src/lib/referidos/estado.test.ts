import { describe, expect, it } from "vitest";
import { casillasDeReferidos, enlaceDeReferido, normalizarCodigoDeReferido, TOPE_REFERIDOS } from "./estado";

describe("normalizarCodigoDeReferido", () => {
  it("acepta 8 caracteres validos y los pasa a mayusculas", () => {
    expect(normalizarCodigoDeReferido(" k7m2qx9a ")).toBe("K7M2QX9A");
  });
  it("rechaza longitudes, caracteres confusos y valores raros", () => {
    expect(normalizarCodigoDeReferido("K7M2QX9")).toBeNull();
    expect(normalizarCodigoDeReferido("K7M2QX9AB")).toBeNull();
    expect(normalizarCodigoDeReferido("K7M2QX90")).toBeNull(); // el 0 no existe en los codigos
    expect(normalizarCodigoDeReferido("K7M2QXIA")).toBeNull(); // la I tampoco
    expect(normalizarCodigoDeReferido("K7M2-X9A")).toBeNull();
    expect(normalizarCodigoDeReferido(null)).toBeNull();
    expect(normalizarCodigoDeReferido(["K7M2QX9A"])).toBeNull();
  });
});

describe("casillasDeReferidos", () => {
  it("siempre devuelve tres casillas", () => {
    expect(casillasDeReferidos({ usados: 0, disponibles: 0, enRevision: 0 })).toEqual(["libre", "libre", "libre"]);
    expect(casillasDeReferidos({ usados: 1, disponibles: 1, enRevision: 1 })).toEqual(["usado", "disponible", "en_revision"]);
    expect(casillasDeReferidos({ usados: 3, disponibles: 0, enRevision: 0 })).toHaveLength(TOPE_REFERIDOS);
  });
  it("nunca pasa del tope aunque los datos vengan de mas", () => {
    expect(casillasDeReferidos({ usados: 2, disponibles: 2, enRevision: 0 })).toEqual(["usado", "usado", "disponible"]);
  });
});

describe("enlaceDeReferido", () => {
  it("arma el enlace de registro con el codigo", () => {
    expect(enlaceDeReferido("K7M2QX9A")).toBe("https://crmbybluee.blue/signup?ref=K7M2QX9A");
  });
});
