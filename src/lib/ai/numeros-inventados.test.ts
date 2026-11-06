import { describe, expect, it } from "vitest";
import { entregaMediosDePago, quitarNumerosInventados } from "@/lib/ai/numeros-inventados";

const REAL = "✅ Nequi → 3166230373 nombre Jua** Tol**\n✅ Daviplata → 3166230373\n✅ Transferencia Bancaria o BRe-B→ 0093148895";

describe("quitarNumerosInventados", () => {
  it("quita un numero de pago que no sale de ninguna fuente", () => {
    const r = quitarNumerosInventados("¡Listo!\n- Nequi: 3204610047\n- Daviplata: 3204610047\nMe envías el comprobante", "Instrucciones sin números");
    expect(r).toEqual({ texto: "¡Listo!\nMe envías el comprobante", quito: true });
  });
  it("quita los datos de relleno, como le paso a un cliente real", () => {
    const r = quitarNumerosInventados("Perfecto, aquí te dejo los medios de pago:\n• *Nequi*: 300xxxxx\n• *Daviplata*: 300xxxxx\n• *Llave*: #####\n• *Bre-B*: [tu cuenta]", "nada");
    expect(r).toEqual({ texto: "Perfecto, aquí te dejo los medios de pago:", quito: true });
  });
  it("deja pasar los datos reales de las instrucciones", () => {
    expect(quitarNumerosInventados(`Puedes pagar con:\n${REAL}`, REAL)).toEqual({ texto: `Puedes pagar con:\n${REAL}`, quito: false });
  });
  it("deja un numero que el cliente ya dio, aunque cambien los separadores", () => {
    expect(quitarNumerosInventados("Te escribo al 300 123 4567", "CLIENTE: mi número es 3001234567").quito).toBe(false);
  });
  it("no toca los precios", () => {
    const r = quitarNumerosInventados("El PRO vale $120.000 al mes, o $800.000 al año", "sin precios");
    expect(r).toEqual({ texto: "El PRO vale $120.000 al mes, o $800.000 al año", quito: false });
  });
  it("detecta numeros con separadores", () => {
    expect(quitarNumerosInventados("Nequi 320-461-0047", "nada").quito).toBe(true);
    expect(quitarNumerosInventados("Cuenta 009 314 8895", "nada").quito).toBe(true);
  });
  it("mencionar un medio sin datos no se toca", () => {
    expect(quitarNumerosInventados("¿Pagas por Nequi o Daviplata?", "nada").quito).toBe(false);
    expect(quitarNumerosInventados("Revisa tu cuenta xx", "nada").quito).toBe(true);
  });
});

describe("entregaMediosDePago", () => {
  it("cuando trae los datos", () => expect(entregaMediosDePago(REAL)).toBe(true));
  it("cuando promete dejarlos", () => {
    expect(entregaMediosDePago("Perfecto, te dejo los medios de pago")).toBe(true);
    expect(entregaMediosDePago("Ya te paso las formas de pago")).toBe(true);
  });
  it("hablar de pagar no manda el QR", () => {
    expect(entregaMediosDePago("¿Pagas por Nequi?")).toBe(false);
    expect(entregaMediosDePago("El PRO vale $120.000 al mes")).toBe(false);
    expect(entregaMediosDePago("¿Te dejo el plan mensual o el anual?")).toBe(false);
  });
});
