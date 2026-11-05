import { describe, expect, it } from "vitest";
import { seccionDeVenta, type ContextoDelCliente } from "@/lib/ai/vendedor";

const base: ContextoDelCliente = { nombre: null, etapa: null, notas: null, etiquetas: [], espacios: [] };

describe("seccionDeVenta", () => {
  it("siempre lleva el objetivo de venta", () => {
    expect(seccionDeVenta(base)).toContain("TU OBJETIVO: vender");
    expect(seccionDeVenta(base)).toContain("Todavía no hay datos de este cliente");
  });
  it("cada etapa le da un objetivo distinto", () => {
    expect(seccionDeVenta({ ...base, etapa: "frio" })).toContain("Etapa actual: Frío. Acaba de llegar");
    expect(seccionDeVenta({ ...base, etapa: "caliente" })).toContain("pídele que envíe el comprobante");
    expect(seccionDeVenta({ ...base, etapa: "pago" })).toContain("No le vendas lo que ya compró");
  });
  it("incluye lo que se sabe del cliente y su cuenta", () => {
    const s = seccionDeVenta({
      ...base,
      nombre: " Laura ",
      etiquetas: ["Interesados"],
      notas: "Vende ropa",
      espacios: [{ workspace_name: "Tienda L", status: "active", plan_name: "Pro", vence: "2026-12-15T12:00:00Z", lineas: 2 }],
    });
    expect(s).toContain("- Nombre: Laura");
    expect(s).toContain("Etiquetas: Interesados");
    expect(s).toContain("Notas del equipo: Vende ropa");
    expect(s).toContain('"Tienda L", plan Pro, estado active, vence el 15 de diciembre de 2026, 2 línea(s)');
  });
  it("le prohibe mostrarle al cliente lo interno", () => {
    expect(seccionDeVenta(base)).toContain("nunca le menciones etapas, etiquetas ni notas");
  });
});
