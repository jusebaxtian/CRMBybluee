import { describe, it, expect } from "vitest";
import { bogotaDayRange, bogotaYesterdayRange } from "@/lib/reports/day";

// Los reportes cortan el dia en horario de Colombia (UTC-5 todo el año), no en
// la zona del servidor —que corre en UTC—. Sin eso, un contacto que llega a
// las 8 de la noche caeria en el reporte del dia siguiente.
describe("bogotaDayRange — el dia de hoy en Colombia", () => {
  it("usa la fecha de Colombia, no la del servidor en UTC", () => {
    // 03:30 UTC del dia 11 son las 22:30 del dia 10 en Colombia.
    const { ymd } = bogotaDayRange(new Date("2026-09-11T03:30:00Z"));
    expect(ymd).toBe("2026-09-10");
  });

  it("el rango abarca exactamente el dia calendario colombiano", () => {
    const { startIso, endIso } = bogotaDayRange(new Date("2026-09-10T15:00:00Z"));
    // 00:00 en Colombia = 05:00 UTC del mismo dia.
    expect(startIso).toBe("2026-09-10T05:00:00.000Z");
    // 23:59:59.999 en Colombia = 04:59:59.999 UTC del dia siguiente.
    expect(endIso).toBe("2026-09-11T04:59:59.999Z");
  });

  it("el inicio es anterior al fin", () => {
    const { startIso, endIso } = bogotaDayRange(new Date("2026-09-10T15:00:00Z"));
    expect(new Date(startIso).getTime()).toBeLessThan(new Date(endIso).getTime());
  });

  it("el momento dado siempre cae dentro de su propio rango", () => {
    for (const instante of [
      "2026-09-10T05:00:00Z", // medianoche en Colombia
      "2026-09-10T17:00:00Z", // mediodia en Colombia
      "2026-09-11T04:59:00Z", // ultimo minuto del dia colombiano
    ]) {
      const ahora = new Date(instante);
      const { startIso, endIso } = bogotaDayRange(ahora);
      expect(ahora.getTime()).toBeGreaterThanOrEqual(new Date(startIso).getTime());
      expect(ahora.getTime()).toBeLessThanOrEqual(new Date(endIso).getTime());
    }
  });

  it("cambia de dia al cruzar la medianoche colombiana, no la UTC", () => {
    // 04:59 UTC sigue siendo el dia anterior en Colombia; 05:00 ya es el nuevo.
    expect(bogotaDayRange(new Date("2026-09-11T04:59:00Z")).ymd).toBe("2026-09-10");
    expect(bogotaDayRange(new Date("2026-09-11T05:00:00Z")).ymd).toBe("2026-09-11");
  });
});

describe("bogotaYesterdayRange — el dia anterior", () => {
  it("devuelve el dia calendario previo", () => {
    expect(bogotaYesterdayRange(new Date("2026-09-10T15:00:00Z")).ymd).toBe("2026-09-09");
  });

  it("cruza bien el cambio de mes", () => {
    expect(bogotaYesterdayRange(new Date("2026-09-01T15:00:00Z")).ymd).toBe("2026-08-31");
  });

  it("cruza bien el cambio de año", () => {
    expect(bogotaYesterdayRange(new Date("2027-01-01T15:00:00Z")).ymd).toBe("2026-12-31");
  });

  it("maneja el 29 de febrero de un año bisiesto", () => {
    expect(bogotaYesterdayRange(new Date("2028-03-01T15:00:00Z")).ymd).toBe("2028-02-29");
  });

  it("termina justo donde empieza el rango de hoy", () => {
    const ahora = new Date("2026-09-10T15:00:00Z");
    const ayer = bogotaYesterdayRange(ahora);
    const hoy = bogotaDayRange(ahora);
    // Un milisegundo entre el fin de ayer y el inicio de hoy: sin huecos ni solapes.
    expect(new Date(hoy.startIso).getTime() - new Date(ayer.endIso).getTime()).toBe(1);
  });
});
