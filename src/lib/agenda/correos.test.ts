import { describe, it, expect } from "vitest";
import { MAX_INVITADOS, agregarCorreos, normalizarCorreos, separarCorreos } from "@/lib/agenda/correos";

describe("separarCorreos", () => {
  it("parte por comas, punto y coma, espacios y saltos de línea", () => {
    expect(separarCorreos("a@x.com, b@y.com; c@z.com\nd@w.com")).toEqual(["a@x.com", "b@y.com", "c@z.com", "d@w.com"]);
  });

  it("quita los < > y comillas que deja copiar desde un correo", () => {
    expect(separarCorreos('"Ana" <ana@x.com>')).toEqual(["Ana", "ana@x.com"]);
  });

  it("un texto vacío no da nada", () => {
    expect(separarCorreos("   ")).toEqual([]);
  });
});

describe("normalizarCorreos", () => {
  it("minúsculas y sin repetidos", () => {
    expect(normalizarCorreos(["Ana@X.com", "ana@x.com", " luis@y.com "])).toEqual({ correos: ["ana@x.com", "luis@y.com"] });
  });

  it("una lista vacía es válida (cita sin invitados)", () => {
    expect(normalizarCorreos([])).toEqual({ correos: [] });
    expect(normalizarCorreos(["", "  "])).toEqual({ correos: [] });
  });

  it("dice cuál correo está mal en vez de descartarlo", () => {
    const r = normalizarCorreos(["ana@x.com", "sin-arroba"]);
    expect("error" in r && r.error).toContain("sin-arroba");
  });

  it("pone un tope", () => {
    const muchos = Array.from({ length: MAX_INVITADOS + 1 }, (_, i) => `u${i}@x.com`);
    expect("error" in normalizarCorreos(muchos)).toBe(true);
    expect("error" in normalizarCorreos(muchos.slice(0, MAX_INVITADOS))).toBe(false);
  });
});

describe("agregarCorreos (el campo de varios correos)", () => {
  it("agrega uno o varios pegados de una vez", () => {
    expect(agregarCorreos([], "ana@x.com, luis@y.com").lista).toEqual(["ana@x.com", "luis@y.com"]);
  });

  it("no repite uno que ya está", () => {
    expect(agregarCorreos(["ana@x.com"], "ANA@x.com, luis@y.com").lista).toEqual(["ana@x.com", "luis@y.com"]);
  });

  it("si hay uno malo, devuelve cuál y conserva lo que ya estaba", () => {
    const r = agregarCorreos(["ana@x.com"], "malo");
    expect(r.rechazado).toBe("malo");
    expect(r.lista).toEqual(["ana@x.com"]);
  });
});
