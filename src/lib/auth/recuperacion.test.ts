import { describe, it, expect } from "vitest";
import {
  coincide,
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
