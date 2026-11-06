import { describe, expect, it } from "vitest";
import { limpiarNumerosDePrueba, vendedorAtiende } from "@/lib/ai/vendedor";

describe("vendedorAtiende", () => {
  const apagado = { activo: false, numeros_prueba: ["573166230373"] };
  it("apagado, solo atiende los numeros de prueba", () => {
    expect(vendedorAtiende(apagado, "573166230373")).toBe(true);
    expect(vendedorAtiende(apagado, "573001112233")).toBe(false);
  });
  it("sin saber quien escribe, apagado no atiende", () => {
    expect(vendedorAtiende(apagado, null)).toBe(false);
    expect(vendedorAtiende(apagado, undefined)).toBe(false);
  });
  it("encendido atiende a todos", () => expect(vendedorAtiende({ ...apagado, activo: true }, "573001112233")).toBe(true));
  it("sin vendedor no atiende", () => expect(vendedorAtiende(null, "573166230373")).toBe(false));
});

describe("limpiarNumerosDePrueba", () => {
  it("acepta como se escriba y agrega el 57", () => {
    expect(limpiarNumerosDePrueba("316 623 0373, +57 300-111-2233")).toEqual(["573166230373", "573001112233"]);
  });
  it("sin repetidos y sin basura", () => {
    expect(limpiarNumerosDePrueba("3166230373\n573166230373, hola, 123")).toEqual(["573166230373"]);
  });
  it("vacio queda vacio", () => expect(limpiarNumerosDePrueba("  ")).toEqual([]));
});
