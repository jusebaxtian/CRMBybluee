import { describe, expect, it } from "vitest";
import { comisionCents, porcentajeValido, resumirVentas, transicionValida } from "./comision";

describe("comisionCents", () => {
  it("calcula el porcentaje y redondea al peso", () => {
    expect(comisionCents(12_000_000, 20)).toBe(2_400_000); // 20% de $120.000 = $24.000
    expect(comisionCents(8_900_000, 15)).toBe(1_335_000); // 15% de $89.000 = $13.350
    expect(comisionCents(10_000, 33.33)).toBe(3_300); // $100 al 33,33% = $33 (sin centavos)
  });
  it("cero o datos invalidos no dan comision", () => {
    expect(comisionCents(0, 20)).toBe(0);
    expect(comisionCents(12_000_000, 0)).toBe(0);
    expect(comisionCents(Number.NaN, 20)).toBe(0);
  });
});

describe("porcentajeValido", () => {
  it("acepta 0 a 100 con coma o punto", () => {
    expect(porcentajeValido("20")).toBe(20);
    expect(porcentajeValido("12,5")).toBe(12.5);
    expect(porcentajeValido(0)).toBe(0);
  });
  it("rechaza fuera de rango o texto", () => {
    expect(porcentajeValido("101")).toBeNull();
    expect(porcentajeValido("-1")).toBeNull();
    expect(porcentajeValido("veinte")).toBeNull();
  });
});

describe("resumirVentas", () => {
  const ahora = new Date("2026-10-28T15:00:00Z");
  const v = (estado: "pendiente" | "aprobada" | "pagada" | "anulada", created_at: string, monto = 12_000_000, comision = 2_400_000) => ({
    estado,
    created_at,
    monto_cents: monto,
    comision_cents: comision,
  });
  it("separa pendiente, por cobrar y pagada; las anuladas no cuentan", () => {
    const r = resumirVentas(
      [v("pendiente", "2026-10-27T15:00:00Z"), v("aprobada", "2026-10-05T15:00:00Z"), v("pagada", "2026-09-10T15:00:00Z"), v("anulada", "2026-10-20T15:00:00Z")],
      ahora
    );
    expect(r.licenciasTotal).toBe(3);
    expect(r.licenciasMes).toBe(2);
    expect(r.vendidoCents).toBe(36_000_000);
    expect(r.pendienteCents).toBe(2_400_000);
    expect(r.porCobrarCents).toBe(2_400_000);
    expect(r.pagadaCents).toBe(2_400_000);
    expect(r.ganadaCents).toBe(4_800_000);
  });
  it("el mes es el de Colombia", () => {
    // 1 de nov 2026 a las 2 a. m. UTC todavia es 31 de octubre en Bogota.
    const r = resumirVentas([v("pendiente", "2026-11-01T02:00:00Z")], new Date("2026-10-31T20:00:00Z"));
    expect(r.licenciasMes).toBe(1);
  });
});

describe("transicionValida", () => {
  it("pendiente -> aprobada/anulada, aprobada -> pagada/anulada, el resto no", () => {
    expect(transicionValida("pendiente", "aprobada")).toBe(true);
    expect(transicionValida("pendiente", "pagada")).toBe(false);
    expect(transicionValida("aprobada", "pagada")).toBe(true);
    expect(transicionValida("aprobada", "anulada")).toBe(true);
    expect(transicionValida("pagada", "anulada")).toBe(false);
    expect(transicionValida("anulada", "aprobada")).toBe(false);
  });
});
