import { describe, it, expect } from "vitest";
import { agruparCiclos, cicloDePlan } from "@/lib/inbox/ciclo-de-plan";

const AHORA = new Date("2026-10-07T18:00:00Z");
const iso = (d: string) => new Date(`${d}T17:00:00Z`).toISOString();
const activo = (ultimo_pago: string | null, vence: string | null, status = "active", es_demo = false) => ({
  status,
  es_demo,
  ultimo_pago: ultimo_pago ? iso(ultimo_pago) : null,
  vence: vence ? iso(vence) : null,
});

describe("cicloDePlan", () => {
  it("un mes de pago a vencimiento es mensual", () => {
    expect(cicloDePlan(activo("2026-09-20", "2026-10-20"), AHORA)).toBe("mensual");
  });

  it("seis meses es semestral y casi un ano es anual", () => {
    expect(cicloDePlan(activo("2026-09-16", "2027-03-16"), AHORA)).toBe("semestral");
    expect(cicloDePlan(activo("2026-09-16", "2027-09-16"), AHORA)).toBe("anual");
  });

  it("no cambia mientras se acerca el vencimiento: depende del periodo pagado, no de lo que queda", () => {
    const anual = activo("2026-01-10", "2027-01-10");
    expect(cicloDePlan(anual, new Date("2026-02-01T12:00:00Z"))).toBe("anual");
    expect(cicloDePlan(anual, new Date("2026-12-20T12:00:00Z"))).toBe("anual");
  });

  it("los limites: 45 dias es mensual, 46 semestral; 220 semestral, 221 anual", () => {
    const desde = new Date("2026-09-01T17:00:00Z").getTime();
    const vence = (dias: number) => ({ status: "active", ultimo_pago: new Date(desde).toISOString(), vence: new Date(desde + dias * 86_400_000).toISOString() });
    expect(cicloDePlan(vence(45), AHORA)).toBe("mensual");
    expect(cicloDePlan(vence(46), AHORA)).toBe("semestral");
    expect(cicloDePlan(vence(220), AHORA)).toBe("semestral");
    expect(cicloDePlan(vence(221), AHORA)).toBe("anual");
  });

  it("sin pago aprobado (cortesia, demo, activacion manual) no hay etiqueta", () => {
    expect(cicloDePlan(activo(null, "2027-09-16"), AHORA)).toBeNull();
  });

  it("sin plan vigente no hay etiqueta: vencido, sin fecha o ya pasada", () => {
    expect(cicloDePlan(activo("2026-08-01", "2026-09-01", "past_due"), AHORA)).toBeNull();
    expect(cicloDePlan(activo("2026-09-20", null), AHORA)).toBeNull();
    // El estado todavia dice "active" pero la fecha ya paso (el trabajo que lo cambia corre cada 5 minutos).
    expect(cicloDePlan(activo("2026-09-01", "2026-10-01"), AHORA)).toBeNull();
  });

  it("un vencimiento anterior al pago no es un periodo valido", () => {
    expect(cicloDePlan(activo("2026-10-01", "2026-09-01"), AHORA)).toBeNull();
  });
});

describe("cuenta DEMO", () => {
  it("un demo vigente se etiqueta DEMO aunque no tenga pagos", () => {
    expect(cicloDePlan(activo(null, "2026-10-10", "active", true), AHORA)).toBe("demo");
  });

  it("un demo vencido o sin plan vigente no tiene etiqueta", () => {
    expect(cicloDePlan(activo(null, "2026-10-01", "active", true), AHORA)).toBeNull();
    expect(cicloDePlan(activo(null, "2026-10-10", "past_due", true), AHORA)).toBeNull();
    expect(cicloDePlan(activo(null, null, "active", true), AHORA)).toBeNull();
  });

  it("al pagar deja de ser demo y se etiqueta por su periodo pagado", () => {
    expect(cicloDePlan(activo("2026-10-05", "2026-11-05", "active", false), AHORA)).toBe("mensual");
  });
});

describe("agruparCiclos", () => {
  it("indexa por numero y, si hay dos espacios con el mismo numero, vale el que vence mas tarde", () => {
    const r = agruparCiclos(
      [
        { wa_id: "573001", ...activo("2026-09-20", "2026-10-20") },
        { wa_id: "573001", ...activo("2026-09-16", "2027-09-16") },
        { wa_id: "573002", ...activo(null, "2027-09-16") },
        { wa_id: "573003", ...activo("2026-08-01", "2026-09-01", "past_due") },
      ],
      AHORA
    );
    expect(r).toEqual({ "573001": "anual" });
  });
});
