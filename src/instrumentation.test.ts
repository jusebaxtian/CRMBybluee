import { describe, it, expect, afterEach } from "vitest";
import { trabajosActivos } from "@/instrumentation";

/**
 * El interruptor que reparte los trabajos de fondo entre el proceso web y el
 * trabajador (Fase 4).
 *
 * Lo que se prueba aqui es el SENTIDO del valor por defecto. Si estuviera al
 * reves, un despliegue que olvidara la variable apagaria en silencio
 * automatizaciones, campañas y seguimientos: sin error y sin aviso, solo
 * clientes que dejan de recibir mensajes.
 */
const original = process.env.RUN_BACKGROUND_JOBS;

afterEach(() => {
  if (original === undefined) delete process.env.RUN_BACKGROUND_JOBS;
  else process.env.RUN_BACKGROUND_JOBS = original;
});

function con(valor: string | undefined) {
  if (valor === undefined) delete process.env.RUN_BACKGROUND_JOBS;
  else process.env.RUN_BACKGROUND_JOBS = valor;
  return trabajosActivos();
}

describe("trabajosActivos — el valor por defecto protege el negocio", () => {
  it("sin la variable, los trabajos CORREN", () => {
    expect(con(undefined)).toBe(true);
  });

  it("con la variable vacia, los trabajos CORREN", () => {
    // Una variable declarada sin valor en un .env es un olvido, no una orden.
    expect(con("")).toBe(true);
  });

  it("un valor que no se reconoce no apaga nada", () => {
    expect(con("si")).toBe(true);
    expect(con("worker")).toBe(true);
  });
});

describe("apagado explicito", () => {
  it("se apaga con 0, false u off", () => {
    expect(con("0")).toBe(false);
    expect(con("false")).toBe(false);
    expect(con("off")).toBe(false);
  });

  it("no distingue mayusculas ni espacios sobrantes", () => {
    expect(con("FALSE")).toBe(false);
    expect(con(" 0 ")).toBe(false);
    expect(con("Off")).toBe(false);
  });

  it("se enciende con 1 o true", () => {
    expect(con("1")).toBe(true);
    expect(con("true")).toBe(true);
  });
});
