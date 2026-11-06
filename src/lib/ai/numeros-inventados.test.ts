import { describe, expect, it } from "vitest";
import { quitarNumerosInventados } from "@/lib/ai/numeros-inventados";

describe("quitarNumerosInventados", () => {
  it("quita un numero de pago que no sale de ninguna fuente", () => {
    const r = quitarNumerosInventados("¡Listo!\n- Nequi: 3204610047\n- Daviplata: 3204610047\nMe envías el comprobante", "Instrucciones sin números");
    expect(r).toEqual({ texto: "¡Listo!\nMe envías el comprobante", quito: true });
  });
  it("deja un numero que el cliente o las instrucciones ya dieron", () => {
    const r = quitarNumerosInventados("Te escribo al 300 123 4567", "CLIENTE: mi número es 3001234567 300 123 4567");
    expect(r.quito).toBe(false);
  });
  it("no toca los precios", () => {
    const r = quitarNumerosInventados("El PRO vale $120.000 al mes, o $800.000 al año", "sin precios");
    expect(r).toEqual({ texto: "El PRO vale $120.000 al mes, o $800.000 al año", quito: false });
  });
  it("detecta numeros con separadores", () => {
    expect(quitarNumerosInventados("Nequi 320-461-0047", "nada").quito).toBe(true);
    expect(quitarNumerosInventados("Cuenta 009 314 8895", "nada").quito).toBe(true);
  });
});
