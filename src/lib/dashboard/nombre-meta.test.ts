import { describe, it, expect } from "vitest";
import { estadoDelNombre } from "@/lib/dashboard/datos";

/**
 * Casos vistos en produccion el 3 oct 2026: Fire EU con NON_EXISTS / NONE
 * (nada aprobado, nada enviado) y las lineas de Credito Brilla con DECLINED.
 */
describe("estadoDelNombre", () => {
  it("sin nombre aprobado ni enviado NO es 'pendiente'", () => {
    expect(estadoDelNombre("NON_EXISTS", "NONE")).toBe("sin_nombre");
  });

  it("un nombre aprobado, o utilizable sin revision, es aprobado", () => {
    expect(estadoDelNombre("APPROVED", "NONE")).toBe("aprobado");
    expect(estadoDelNombre("AVAILABLE_WITHOUT_REVIEW", undefined)).toBe("aprobado");
  });

  it("aprobado manda aunque haya otro nombre en revision", () => {
    expect(estadoDelNombre("APPROVED", "PENDING_REVIEW")).toBe("aprobado");
  });

  it("solo lo enviado a revision se ve como en revision", () => {
    expect(estadoDelNombre("NON_EXISTS", "PENDING_REVIEW")).toBe("en_revision");
    expect(estadoDelNombre("PENDING_REVIEW", "NONE")).toBe("en_revision");
  });

  it("un nombre rechazado se dice rechazado", () => {
    expect(estadoDelNombre("DECLINED", "NONE")).toBe("rechazado");
  });

  it("sin dato o con un valor desconocido no inventa nada", () => {
    expect(estadoDelNombre(undefined, undefined)).toBeNull();
    expect(estadoDelNombre("ALGO_NUEVO", "NONE")).toBeNull();
  });
});
