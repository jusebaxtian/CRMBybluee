import { describe, it, expect } from "vitest";
import { estadoDeVerificacion } from "@/lib/dashboard/datos";

/**
 * Lo que Meta devuelve en business_verification_status. El 3 oct 2026 la linea
 * de Ventas (Fire EU) salia verified y la de Soporte (VIORA) not_verified,
 * dos lineas del mismo cliente con estados distintos.
 */
describe("estadoDeVerificacion", () => {
  it("traduce los dos valores confirmados contra Meta", () => {
    expect(estadoDeVerificacion("verified")).toBe("verificado");
    expect(estadoDeVerificacion("not_verified")).toBe("sin_verificar");
  });

  it("los estados en curso se ven como en revision", () => {
    expect(estadoDeVerificacion("pending")).toBe("pendiente");
    expect(estadoDeVerificacion("pending_submission")).toBe("pendiente");
  });

  it("un fallo o revocacion no se muestra como verificado", () => {
    expect(estadoDeVerificacion("failed")).toBe("sin_verificar");
    expect(estadoDeVerificacion("revoked")).toBe("sin_verificar");
  });

  it("sin dato o con un valor desconocido no inventa nada", () => {
    expect(estadoDeVerificacion(undefined)).toBeNull();
    expect(estadoDeVerificacion("algo_nuevo_de_meta")).toBeNull();
  });
});
