import { describe, expect, it } from "vitest";
import { avisoDeComprobante, interpretarLectura, turnoDeImagen } from "@/lib/ai/lectura-imagen";

const lectura = { descripcion: "Pago por Nequi", esComprobante: true, valor: "$85.000", banco: "Nequi", fecha: null };

describe("interpretarLectura", () => {
  it("lee el JSON, aunque venga con texto alrededor", () => {
    const r = interpretarLectura('Claro:\n```json\n{"descripcion":"Zapatos rojos","esComprobante":false,"valor":null}\n```');
    expect(r).toEqual({ descripcion: "Zapatos rojos", esComprobante: false, valor: null, banco: null, fecha: null });
  });
  it("sin JSON valido o sin descripcion no hay lectura", () => {
    expect(interpretarLectura("no pude ver la imagen")).toBeNull();
    expect(interpretarLectura('{"descripcion":')).toBeNull();
    expect(interpretarLectura('{"esComprobante":true}')).toBeNull();
  });
  it("solo un true real cuenta como comprobante", () => {
    expect(interpretarLectura('{"descripcion":"x","esComprobante":"true"}')?.esComprobante).toBe(false);
    expect(interpretarLectura('{"descripcion":"x","esComprobante":true}')?.esComprobante).toBe(true);
  });
  it("recorta textos largos", () => {
    expect(interpretarLectura(JSON.stringify({ descripcion: "a".repeat(900) }))?.descripcion).toHaveLength(600);
  });
});

describe("turnoDeImagen", () => {
  it("marca el comprobante y conserva lo que escribio el cliente", () => {
    const t = turnoDeImagen(lectura, " ya pagué ");
    expect(t).toContain("COMPROBANTE DE PAGO");
    expect(t).toContain("El cliente escribió con la imagen: ya pagué");
  });
  it("una imagen normal no se marca como comprobante", () => {
    expect(turnoDeImagen({ ...lectura, esComprobante: false }, null)).toBe("[Imagen del cliente] Pago por Nequi");
  });
});

describe("avisoDeComprobante", () => {
  it("muestra los datos que encontro", () => {
    const a = avisoDeComprobante(lectura, "Laura");
    expect(a.titulo).toBe("🧾 Detectó soporte de pago: Laura");
    expect(a.cuerpo).toBe("$85.000 · Nequi. Revísalo antes de confirmar el pago.");
  });
  it("sin datos sigue avisando", () => {
    expect(avisoDeComprobante({ ...lectura, valor: null, banco: null }, "Laura").cuerpo).toBe("Revísalo antes de confirmar el pago.");
  });
});
