import { describe, expect, it } from "vitest";
import { planDeGuardado } from "@/lib/flujos/plan-de-guardado";

describe("planDeGuardado", () => {
  it("conserva los que siguen, crea los nuevos y borra los que ya no estan", () => {
    const p = planDeGuardado(["a", "b", "c"], [{ id: "a" }, { id: "c" }, { id: "n123" }]);
    expect(p.actualizar.map((n) => n.id)).toEqual(["a", "c"]);
    expect(p.crear.map((n) => n.id)).toEqual(["n123"]);
    expect(p.borrar).toEqual(["b"]);
  });
  it("guardar sin cambios no crea ni borra nada", () => {
    const p = planDeGuardado(["a", "b"], [{ id: "a" }, { id: "b" }]);
    expect(p.crear).toEqual([]);
    expect(p.borrar).toEqual([]);
  });
  it("un flujo nuevo solo crea", () => {
    const p = planDeGuardado([], [{ id: "n1" }]);
    expect(p.crear).toHaveLength(1);
    expect(p.actualizar).toEqual([]);
  });
});
