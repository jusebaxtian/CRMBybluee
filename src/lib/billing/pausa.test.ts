import { describe, expect, it } from "vitest";
import { estaPausado, listaParaExcluir } from "./pausa";

describe("estaPausado", () => {
  it("vencida, cancelada, suspendida o desactivada: pausada", () => {
    expect(estaPausado({ status: "past_due" })).toBe(true);
    expect(estaPausado({ status: "canceled" })).toBe(true);
    expect(estaPausado({ status: "suspended" })).toBe(true);
    expect(estaPausado({ status: "active", access_disabled: true })).toBe(true);
  });
  it("activa o en prueba: corre normal", () => {
    expect(estaPausado({ status: "active", access_disabled: false })).toBe(false);
    expect(estaPausado({ status: "trialing" })).toBe(false);
    expect(estaPausado(null)).toBe(false);
  });
});

describe("listaParaExcluir", () => {
  it("arma la lista para la consulta, o nada si no hay pausadas", () => {
    expect(listaParaExcluir([])).toBeNull();
    expect(listaParaExcluir(["a", "b"])).toBe("(a,b)");
  });
});
