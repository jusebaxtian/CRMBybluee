import { describe, it, expect } from "vitest";
import { NIVEL_MINIMO, formatoDeReloj, nivelDeMuestra, resumirNiveles, ultimasBarras } from "@/lib/inbox/nota-de-voz";

describe("nivelDeMuestra", () => {
  it("el silencio (128) da el nivel minimo, no cero", () => {
    expect(nivelDeMuestra(new Uint8Array(64).fill(128))).toBe(NIVEL_MINIMO);
  });

  it("una voz fuerte llena la barra", () => {
    const onda = Uint8Array.from({ length: 64 }, (_, i) => (i % 2 === 0 ? 228 : 28));
    expect(nivelDeMuestra(onda)).toBe(1);
  });

  it("una voz suave da un nivel intermedio", () => {
    const onda = Uint8Array.from({ length: 64 }, (_, i) => (i % 2 === 0 ? 144 : 112));
    const nivel = nivelDeMuestra(onda);
    expect(nivel).toBeGreaterThan(NIVEL_MINIMO);
    expect(nivel).toBeLessThan(1);
  });

  it("sin muestras no revienta", () => {
    expect(nivelDeMuestra([])).toBe(NIVEL_MINIMO);
  });
});

describe("resumirNiveles", () => {
  it("devuelve exactamente n barras, promediando tramos", () => {
    const r = resumirNiveles([0.2, 0.4, 0.6, 0.8], 2);
    expect(r).toHaveLength(2);
    expect(r[0]).toBeCloseTo(0.3);
    expect(r[1]).toBeCloseTo(0.7);
  });

  it("con menos datos que barras repite sin dejar huecos", () => {
    const r = resumirNiveles([0.5], 5);
    expect(r).toHaveLength(5);
    expect(r.every((x) => x === 0.5)).toBe(true);
  });

  it("sin datos devuelve barras bajas y parejas", () => {
    expect(resumirNiveles([], 4)).toEqual([0.2, 0.2, 0.2, 0.2]);
  });
});

describe("ultimasBarras", () => {
  it("rellena a la izquierda mientras no hay suficientes", () => {
    expect(ultimasBarras([0.5, 0.9], 4)).toEqual([NIVEL_MINIMO, NIVEL_MINIMO, 0.5, 0.9]);
  });

  it("se queda con las ultimas n", () => {
    expect(ultimasBarras([0.1, 0.2, 0.3, 0.4, 0.5], 3)).toEqual([0.3, 0.4, 0.5]);
  });
});

describe("formatoDeReloj", () => {
  it("minutos y segundos con dos cifras", () => {
    expect(formatoDeReloj(0)).toBe("00:00");
    expect(formatoDeReloj(7)).toBe("00:07");
    expect(formatoDeReloj(75)).toBe("01:15");
    expect(formatoDeReloj(7.9)).toBe("00:07");
    expect(formatoDeReloj(-3)).toBe("00:00");
  });
});
