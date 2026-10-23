import { describe, it, expect } from "vitest";
import { avanceDeAudio, formatoDeTiempo, ondaDeAudio, razonDelPuntero } from "@/lib/inbox/audio-de-nota";

describe("ondaDeAudio", () => {
  it("da exactamente las barras pedidas, todas entre 0 y 1", () => {
    const onda = ondaDeAudio("https://x/audio-1.ogg", 40);
    expect(onda).toHaveLength(40);
    expect(onda.every((a) => a > 0 && a <= 1)).toBe(true);
  });

  it("es la misma cada vez para el mismo audio", () => {
    expect(ondaDeAudio("https://x/a.ogg", 40)).toEqual(ondaDeAudio("https://x/a.ogg", 40));
  });

  it("cada audio tiene su propia forma", () => {
    expect(ondaDeAudio("https://x/a.ogg", 40)).not.toEqual(ondaDeAudio("https://x/b.ogg", 40));
  });

  it("no es plana: tiene picos y partes bajas", () => {
    const onda = ondaDeAudio("https://x/c.ogg", 40);
    expect(Math.max(...onda) - Math.min(...onda)).toBeGreaterThan(0.25);
  });

  it("sin barras no revienta", () => {
    expect(ondaDeAudio("x", 0)).toEqual([]);
    expect(ondaDeAudio("", 5)).toHaveLength(5);
  });
});

describe("razonDelPuntero", () => {
  it("mitad de la onda es 0,5", () => {
    expect(razonDelPuntero(150, 100, 100)).toBe(0.5);
  });
  it("fuera de la onda se queda en los extremos", () => {
    expect(razonDelPuntero(50, 100, 100)).toBe(0);
    expect(razonDelPuntero(500, 100, 100)).toBe(1);
  });
  it("una onda sin ancho no divide por cero", () => {
    expect(razonDelPuntero(10, 0, 0)).toBe(0);
  });
});

describe("formatoDeTiempo y avanceDeAudio", () => {
  it("escribe minutos y segundos", () => {
    expect(formatoDeTiempo(0)).toBe("0:00");
    expect(formatoDeTiempo(34.9)).toBe("0:34");
    expect(formatoDeTiempo(65)).toBe("1:05");
    expect(formatoDeTiempo(Infinity)).toBe("0:00");
    expect(formatoDeTiempo(NaN)).toBe("0:00");
  });
  it("el avance es 0 mientras no se conoce la duracion", () => {
    expect(avanceDeAudio(5, Infinity)).toBe(0);
    expect(avanceDeAudio(5, 0)).toBe(0);
    expect(avanceDeAudio(5, NaN)).toBe(0);
  });
  it("el avance se queda entre 0 y 1", () => {
    expect(avanceDeAudio(17, 34)).toBe(0.5);
    expect(avanceDeAudio(40, 34)).toBe(1);
    expect(avanceDeAudio(-2, 34)).toBe(0);
  });
});
