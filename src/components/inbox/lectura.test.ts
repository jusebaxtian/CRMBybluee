import { describe, expect, it } from "vitest";
import { cuandoCorto } from "@/components/inbox/message-bubble";

// 23 nov 2026, 3:00 p. m. en Bogota (UTC-5).
const AHORA = new Date("2026-11-23T20:00:00Z");

describe("cuandoCorto", () => {
  it("dice hoy con la hora de Bogota", () => {
    expect(cuandoCorto("2026-11-23T19:41:00Z", AHORA)).toMatch(/^hoy 2:41/);
  });
  it("dice ayer", () => {
    expect(cuandoCorto("2026-11-22T14:05:00Z", AHORA)).toMatch(/^ayer 9:05/);
  });
  it("usa la fecha de Bogota y no la de UTC", () => {
    // 2:30 a. m. UTC del 23 = 9:30 p. m. del 22 en Bogota.
    expect(cuandoCorto("2026-11-23T02:30:00Z", AHORA)).toMatch(/^ayer 9:30/);
  });
  it("muestra el dia y el mes si es mas viejo", () => {
    expect(cuandoCorto("2026-11-20T21:10:00Z", AHORA)).toMatch(/^20 de nov/);
  });
});
