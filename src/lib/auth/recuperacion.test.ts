import { describe, it, expect } from "vitest";
import {
  coincide,
  esperaEntreEnvios,
  veredictoDelCodigo,
  generarCodigo,
  generarPermiso,
  hashDe,
  soloDigitos,
  telefonoTapado,
} from "@/lib/auth/recuperacion";

describe("recuperación por WhatsApp", () => {
  it("genera códigos de 6 dígitos, incluidos los que empiezan por cero", () => {
    for (let i = 0; i < 500; i += 1) {
      expect(generarCodigo()).toMatch(/^\d{6}$/);
    }
  });

  it("no repite el mismo código todo el tiempo", () => {
    const vistos = new Set(Array.from({ length: 200 }, () => generarCodigo()));
    expect(vistos.size).toBeGreaterThan(150);
  });

  it("acepta el código correcto y rechaza el resto", () => {
    const codigo = "048217";
    const guardado = hashDe(codigo);
    expect(coincide(guardado, codigo)).toBe(true);
    expect(coincide(guardado, "048218")).toBe(false);
    expect(coincide(guardado, "48217")).toBe(false);
    expect(coincide(guardado, "")).toBe(false);
  });

  it("no guarda el código en claro", () => {
    expect(hashDe("123456")).not.toContain("123456");
    expect(hashDe("123456")).toHaveLength(64);
  });

  it("los permisos son largos y distintos entre sí", () => {
    const a = generarPermiso();
    const b = generarPermiso();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43);
  });

  it("tapa el teléfono dejando solo los dos últimos dígitos", () => {
    expect(telefonoTapado("+573223494569")).toBe("•••• ••69");
    expect(telefonoTapado("+57 322 3494569")).toBe("•••• ••69");
    expect(telefonoTapado("123")).toBe("••••");
  });

  it("deja el número como lo espera WhatsApp", () => {
    expect(soloDigitos("+57 322 3494569")).toBe("573223494569");
  });
});

describe("cuándo un código deja de servir", () => {
  const dentroDe = (minutos: number) => new Date(Date.now() + minutos * 60_000).toISOString();

  it("sirve el recién emitido", () => {
    expect(veredictoDelCodigo({ expires_at: dentroDe(10), attempts: 0, consumed_at: null })).toEqual({
      sirve: true,
    });
  });

  it("no sirve el vencido, aunque nadie lo haya usado", () => {
    expect(veredictoDelCodigo({ expires_at: dentroDe(-1), attempts: 0, consumed_at: null })).toEqual({
      sirve: false,
      motivo: "vencido",
    });
  });

  it("no sirve dos veces", () => {
    expect(
      veredictoDelCodigo({ expires_at: dentroDe(10), attempts: 0, consumed_at: new Date().toISOString() })
    ).toEqual({ sirve: false, motivo: "usado" });
  });

  it("se quema a los 5 intentos fallidos", () => {
    expect(veredictoDelCodigo({ expires_at: dentroDe(10), attempts: 4, consumed_at: null })).toEqual({
      sirve: true,
    });
    expect(veredictoDelCodigo({ expires_at: dentroDe(10), attempts: 5, consumed_at: null })).toEqual({
      sirve: false,
      motivo: "sin_intentos",
    });
  });

  it("sin código guardado, no sirve", () => {
    expect(veredictoDelCodigo(null).sirve).toBe(false);
  });
});

describe("espera entre envíos", () => {
  it("no hace esperar si nunca se pidió", () => {
    expect(esperaEntreEnvios(null)).toBe(0);
  });

  it("hace esperar el minuto completo justo después de pedirlo", () => {
    expect(esperaEntreEnvios(new Date().toISOString())).toBeGreaterThan(55);
  });

  it("deja pedir otro pasado el minuto", () => {
    expect(esperaEntreEnvios(new Date(Date.now() - 61_000).toISOString())).toBe(0);
  });
});
