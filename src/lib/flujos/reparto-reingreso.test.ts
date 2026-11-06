import { describe, expect, it } from "vitest";
import { puedeReingresar, reingresosDeFin, repartoParejo, resumenDe } from "@/lib/flujos/bloques";
import { revisarFlujo, type NodoParaValidar } from "@/lib/flujos/validar";

describe("reingresosDeFin", () => {
  it("un Fin viejo, sin configurar, sigue sin limite", () => {
    expect(reingresosDeFin({})).toBeNull();
    expect(reingresosDeFin({ reingreso: "siempre" })).toBeNull();
  });
  it("no puede volver = cero veces mas", () => expect(reingresosDeFin({ reingreso: "no" })).toBe(0));
  it("usa las veces elegidas, y al menos una", () => {
    expect(reingresosDeFin({ reingreso: "veces", reingresoVeces: 3 })).toBe(3);
    expect(reingresosDeFin({ reingreso: "veces", reingresoVeces: 0 })).toBe(1);
    expect(reingresosDeFin({ reingreso: "veces" })).toBe(1);
  });
});

describe("puedeReingresar", () => {
  it("sin limite siempre puede", () => expect(puedeReingresar(null, 50)).toBe(true));
  it("con no puede volver, ya no entra", () => expect(puedeReingresar(0, 1)).toBe(false));
  it("con 2 veces: entra 3 en total (la primera y dos mas)", () => {
    expect(puedeReingresar(2, 1)).toBe(true);
    expect(puedeReingresar(2, 2)).toBe(true);
    expect(puedeReingresar(2, 3)).toBe(false);
  });
});

describe("repartoParejo", () => {
  it("siempre suma 100", () => {
    const r = repartoParejo(["a", "b", "c"]);
    expect(r.map((x) => x.porcentaje)).toEqual([34, 33, 33]);
    expect(r.reduce((s, x) => s + x.porcentaje, 0)).toBe(100);
  });
  it("sin agentes queda vacio", () => expect(repartoParejo([])).toEqual([]));
});

describe("resumen del bloque", () => {
  it("muestra el reparto", () => {
    expect(resumenDe("agente", {})).toBe("Reparto parejo entre el equipo");
    expect(resumenDe("agente", { agenteId: "a", agenteNombre: "Ana" })).toBe("Para Ana");
    expect(
      resumenDe("agente", {
        repartoAgentes: [
          { agenteId: "a", nombre: "Ana", porcentaje: 70 },
          { agenteId: "b", nombre: "Luis", porcentaje: 30 },
          { agenteId: "c", nombre: "Eva", porcentaje: 0 },
        ],
      })
    ).toBe("Ana 70% · Luis 30%");
  });
  it("muestra el reingreso del Fin", () => {
    expect(resumenDe("fin", { reingreso: "no" })).toBe("Sale y no puede volver a este flujo");
    expect(resumenDe("fin", { reingreso: "veces", reingresoVeces: 2 })).toBe("Sale y puede volver 2 veces");
    expect(resumenDe("fin", {})).toBe("El contacto sale del flujo");
  });
});

describe("avisos del flujo", () => {
  const conAgente = (datos: NodoParaValidar["datos"]): NodoParaValidar[] => [{ id: "n", tipo: "agente", datos }];
  const errores = (n: NodoParaValidar[]) => revisarFlujo(n, []).filter((a) => a.nivel === "error" && a.nodoId === "n").map((a) => a.texto);

  it("los porcentajes tienen que sumar 100", () => {
    expect(errores(conAgente({ repartoAgentes: [{ agenteId: "a", nombre: "Ana", porcentaje: 70 }] }))[0]).toContain("suman 70%");
    expect(errores(conAgente({ repartoAgentes: [{ agenteId: "a", nombre: "Ana", porcentaje: 100 }] }))).toEqual([]);
  });
  it("un bloque viejo, sin porcentajes, no da error", () => expect(errores(conAgente({}))).toEqual([]));
  it("el Fin con veces pide al menos 1", () => {
    const n: NodoParaValidar[] = [{ id: "n", tipo: "fin", datos: { reingreso: "veces", reingresoVeces: 0 } }];
    expect(errores(n)[0]).toContain("al menos 1");
  });
});
