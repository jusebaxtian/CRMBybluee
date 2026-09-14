import { describe, it, expect } from "vitest";
import { componerTelefono, listaDePaises } from "./telefono";

describe("componerTelefono — WhatsApp del registro en E.164", () => {
  it("Colombia: 3001234567 -> +573001234567", () => {
    expect(componerTelefono("CO", "300 123 4567")).toEqual({
      countryCode: "+57",
      local: "3001234567",
      e164: "+573001234567",
      digitos: "573001234567",
    });
  });
  it("Estados Unidos: 3052345678 -> +13052345678", () => {
    // (305) 123-4567 no existe en Norteamerica: la central no puede empezar
    // por 0 o 1, y la libreria lo rechaza igual que lo haria WhatsApp.
    expect(componerTelefono("US", "3052345678")?.e164).toBe("+13052345678");
    expect(componerTelefono("US", "3051234567")).toBeNull();
  });
  it("rechaza un numero que no es valido para el pais", () => {
    expect(componerTelefono("CO", "12345")).toBeNull();
    expect(componerTelefono("CO", "")).toBeNull();
  });
  it("la lista trae Colombia con +57 y bandera", () => {
    const co = listaDePaises().find((p) => p.iso === "CO");
    expect(co?.indicativo).toBe("+57");
    expect(co?.bandera).toBe("🇨🇴");
    expect(co?.nombre).toBe("Colombia");
  });
});
