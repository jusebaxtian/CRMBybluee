import { describe, expect, it } from "vitest";
import { aMinutos, conversacionActiva, enSilencio, finDelSilencio, minutoEnBogota, ventanaAbierta } from "@/lib/silencio";

// Bogota = UTC-5. 23:00 Bogota = 04:00 UTC del dia siguiente.
const bogota = (iso: string) => new Date(`${iso}-05:00`);
const noche = { activo: true, inicio: "22:00", fin: "05:00" };

describe("horario de silencio", () => {
  it("lee las horas", () => {
    expect(aMinutos("22:00")).toBe(1320);
    expect(aMinutos("5:30")).toBe(330);
    expect(aMinutos("25:00")).toBeNull();
  });

  it("calcula el minuto en Bogota", () => {
    expect(minutoEnBogota(bogota("2026-11-27T23:15:00"))).toBe(23 * 60 + 15);
  });

  it("cruza la medianoche: 22:00 a 05:00", () => {
    expect(enSilencio(noche, bogota("2026-11-27T21:59:00"))).toBe(false);
    expect(enSilencio(noche, bogota("2026-11-27T22:00:00"))).toBe(true);
    expect(enSilencio(noche, bogota("2026-11-28T02:00:00"))).toBe(true);
    expect(enSilencio(noche, bogota("2026-11-28T04:59:00"))).toBe(true);
    expect(enSilencio(noche, bogota("2026-11-28T05:00:00"))).toBe(false);
  });

  it("horario dentro del mismo dia: 13:00 a 14:00", () => {
    const almuerzo = { activo: true, inicio: "13:00", fin: "14:00" };
    expect(enSilencio(almuerzo, bogota("2026-11-27T13:30:00"))).toBe(true);
    expect(enSilencio(almuerzo, bogota("2026-11-27T14:30:00"))).toBe(false);
  });

  it("apagado nunca silencia", () => {
    expect(enSilencio({ ...noche, activo: false }, bogota("2026-11-28T02:00:00"))).toBe(false);
  });

  it("el fin del silencio es las 05:00 siguientes", () => {
    expect(finDelSilencio(noche, bogota("2026-11-27T23:00:00")).toISOString()).toBe(bogota("2026-11-28T05:00:00").toISOString());
    expect(finDelSilencio(noche, bogota("2026-11-28T03:10:00")).toISOString()).toBe(bogota("2026-11-28T05:00:00").toISOString());
  });

  it("conversacion activa (escribio hace menos de 30 min) y ventana de 24 h", () => {
    const ahora = bogota("2026-11-28T02:00:00");
    expect(conversacionActiva(bogota("2026-11-28T01:45:00").toISOString(), ahora)).toBe(true);
    expect(conversacionActiva(bogota("2026-11-28T01:00:00").toISOString(), ahora)).toBe(false);
    expect(ventanaAbierta(bogota("2026-11-27T10:00:00").toISOString(), ahora)).toBe(true);
    expect(ventanaAbierta(bogota("2026-11-26T10:00:00").toISOString(), ahora)).toBe(false);
    expect(ventanaAbierta(null, ahora)).toBe(false);
  });
});
