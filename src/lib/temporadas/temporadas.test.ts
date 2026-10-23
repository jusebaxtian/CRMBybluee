import { describe, it, expect } from "vitest";
import { temporadaActiva } from "@/lib/temporadas/temporadas";

// Las horas se dan en Bogotá (UTC-5): "00:00 en Bogotá" es 05:00 UTC.
const bogota = (iso: string) => new Date(`${iso}-05:00`).getTime();

describe("Halloween: del 28 al 31 de octubre de 2026", () => {
  it("el 27 todavía no", () => {
    expect(temporadaActiva(bogota("2026-10-27T23:59:59"))).toBeNull();
  });

  it("se enciende a la medianoche del 28 y sigue hasta el último segundo del 31", () => {
    expect(temporadaActiva(bogota("2026-10-28T00:00:00"))).toBe("halloween");
    expect(temporadaActiva(bogota("2026-10-30T12:00:00"))).toBe("halloween");
    expect(temporadaActiva(bogota("2026-10-31T23:59:59"))).toBe("halloween");
  });

  it("se apaga solo el 1 de noviembre", () => {
    expect(temporadaActiva(bogota("2026-11-01T00:00:00"))).toBeNull();
  });
});

describe("Navidad: del 7 al 25 de diciembre de 2026", () => {
  it("el 6 todavía no", () => {
    expect(temporadaActiva(bogota("2026-12-06T23:59:59"))).toBeNull();
  });

  it("se enciende el 7 y sigue hasta el 25 inclusive", () => {
    expect(temporadaActiva(bogota("2026-12-07T00:00:00"))).toBe("navidad");
    expect(temporadaActiva(bogota("2026-12-24T20:00:00"))).toBe("navidad");
    expect(temporadaActiva(bogota("2026-12-25T23:59:59"))).toBe("navidad");
  });

  it("se apaga el 26", () => {
    expect(temporadaActiva(bogota("2026-12-26T00:00:00"))).toBeNull();
  });
});

describe("Ofertas: del 15 al 17 de octubre de 2026", () => {
  it("el 14 todavía no, del 15 al 17 sí, y el 18 ya no", () => {
    expect(temporadaActiva(bogota("2026-10-14T23:59:59"))).toBeNull();
    expect(temporadaActiva(bogota("2026-10-15T00:00:00"))).toBe("ofertas");
    expect(temporadaActiva(bogota("2026-10-16T12:00:00"))).toBe("ofertas");
    expect(temporadaActiva(bogota("2026-10-17T23:59:59"))).toBe("ofertas");
    expect(temporadaActiva(bogota("2026-10-18T00:00:00"))).toBeNull();
  });
});

describe("entre temporadas y otros años", () => {
  it("el resto del año no hay etiqueta", () => {
    expect(temporadaActiva(bogota("2026-11-15T10:00:00"))).toBeNull();
    expect(temporadaActiva(bogota("2026-06-10T10:00:00"))).toBeNull();
  });

  it("no se activa en otros años", () => {
    expect(temporadaActiva(bogota("2027-10-30T12:00:00"))).toBeNull();
    expect(temporadaActiva(bogota("2027-12-20T12:00:00"))).toBeNull();
  });

  it("usa la fecha de Bogotá aunque el servidor ya esté en el día siguiente en UTC", () => {
    // 25 de diciembre 21:00 en Bogotá ya es 26 de diciembre 02:00 UTC: sigue activa.
    expect(temporadaActiva(Date.UTC(2026, 11, 26, 2, 0, 0))).toBe("navidad");
    // 6 de diciembre 22:00 en Bogotá ya es 7 de diciembre 03:00 UTC: todavía no.
    expect(temporadaActiva(Date.UTC(2026, 11, 7, 3, 0, 0))).toBeNull();
  });
});
