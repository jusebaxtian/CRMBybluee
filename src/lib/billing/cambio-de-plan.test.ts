import { describe, it, expect } from "vitest";
import { planSeAplica, proximoPlan } from "@/lib/billing/cambio-de-plan";
import { validarDatosLegales } from "@/lib/soporte/documento";

describe("planSeAplica", () => {
  it("se aplica cuando lo pagado es exactamente el precio del plan", () => {
    expect(planSeAplica(12000000, 12000000)).toBe(true);
  });
  it("NO se aplica con un comprobante menor al precio: el truco de los $1", () => {
    expect(planSeAplica(12000000, 100)).toBe(false);
  });
  it("tampoco con uno mayor: un pago de mas no es el pago de ese plan", () => {
    expect(planSeAplica(8900000, 12000000)).toBe(false);
  });
  it("un plan sin precio nunca se aplica por pago", () => {
    expect(planSeAplica(0, 0)).toBe(false);
  });
});

describe("proximoPlan", () => {
  // Los precios reales de produccion el 6 oct 2026, en centavos.
  const planes = [
    { id: "pro-meses", price_cents: 50000000 },
    { id: "inicial", price_cents: 8900000 },
    { id: "pro", price_cents: 12000000 },
  ];
  it("desde Inicial el siguiente nivel es PRO, aunque la lista venga desordenada", () => {
    expect(proximoPlan(planes, 8900000)?.id).toBe("pro");
  });
  it("desde PRO el siguiente es el semestral", () => {
    expect(proximoPlan(planes, 12000000)?.id).toBe("pro-meses");
  });
  it("desde el mas caro no hay siguiente", () => {
    expect(proximoPlan(planes, 50000000)).toBeNull();
  });
  it("un plan actual que ya no se ofrece y es mas barato que todos: el siguiente es el mas barato", () => {
    expect(proximoPlan(planes, 5000000)?.id).toBe("inicial");
  });
});

describe("validarDatosLegales", () => {
  const ok = { razonSocial: "Distribuidora Ñandú S.A.S.", tipo: "NIT", numero: "900.123.456-7", direccion: "Carrera 15 # 93-60, Bogotá" };
  const v = (o: Partial<typeof ok> = {}) => {
    const d = { ...ok, ...o };
    return validarDatosLegales(d.razonSocial, d.tipo, d.numero, d.direccion);
  };

  it("acepta los cuatro datos completos", () => {
    expect(v()).toEqual({ razonSocial: "Distribuidora Ñandú S.A.S.", tipo: "NIT", numero: "900.123.456-7", direccion: "Carrera 15 # 93-60, Bogotá" });
  });
  it("los cuatro son obligatorios, porque despues no se pueden completar", () => {
    expect("error" in v({ razonSocial: "" })).toBe(true);
    expect("error" in v({ numero: "" })).toBe(true);
    expect("error" in v({ direccion: "" })).toBe(true);
    expect("error" in v({ direccion: "ab" })).toBe(true);
  });
  it("limpia espacios y saltos de linea del nombre", () => {
    const r = v({ razonSocial: "  Mi   Empresa \n SAS  " });
    expect("error" in r ? "" : r.razonSocial).toBe("Mi Empresa SAS");
  });
  it("rechaza un nombre larguisimo", () => {
    expect("error" in v({ razonSocial: "x".repeat(121) })).toBe(true);
  });
});
