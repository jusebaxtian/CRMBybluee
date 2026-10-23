import { describe, it, expect } from "vitest";
import { planDeEtiquetado, waIdDeEspacio, type EspacioDemo } from "@/lib/demo/etiqueta-demo";

const demo = (extra: Partial<EspacioDemo> = {}): EspacioDemo => ({
  id: "w1",
  name: "Ferretería El Tornillo",
  waId: "573001112233",
  clienteContactId: null,
  persona: "Carlos Pérez",
  ...extra,
});

describe("waIdDeEspacio", () => {
  it("usa el E.164 sin simbolos", () => {
    expect(waIdDeEspacio("+573001112233", null)).toBe("573001112233");
  });
  it("un celular colombiano de 10 cifras lleva el 57, como en la base", () => {
    expect(waIdDeEspacio(null, "300 111 2233")).toBe("573001112233");
  });
  it("un numero de otro pais no se toca", () => {
    expect(waIdDeEspacio("+12025550123", null)).toBe("12025550123");
  });
  it("sin telefono no hay numero", () => {
    expect(waIdDeEspacio(null, null)).toBeNull();
    expect(waIdDeEspacio("", "  ")).toBeNull();
  });
});

describe("planDeEtiquetado", () => {
  it("etiqueta al contacto que ya existe y todavia no tiene la etiqueta", () => {
    const plan = planDeEtiquetado([demo()], [{ id: "c1", waId: "573001112233" }], new Set());
    expect(plan).toEqual({ crear: [], etiquetar: ["c1"] });
  });

  it("no repite: si ya la tiene, no hace nada", () => {
    const plan = planDeEtiquetado([demo()], [{ id: "c1", waId: "573001112233" }], new Set(["c1"]));
    expect(plan).toEqual({ crear: [], etiquetar: [] });
  });

  it("si el cliente nunca le escribio al administrador, crea el contacto con persona y negocio", () => {
    const plan = planDeEtiquetado([demo()], [], new Set());
    expect(plan.crear).toEqual([{ waId: "573001112233", nombre: "Carlos (Ferretería El Tornillo)" }]);
    expect(plan.etiquetar).toEqual([]);
  });

  it("el vinculo manual manda sobre el telefono", () => {
    const plan = planDeEtiquetado(
      [demo({ clienteContactId: "manual" })],
      [
        { id: "manual", waId: "573009998877" },
        { id: "porTelefono", waId: "573001112233" },
      ],
      new Set()
    );
    expect(plan.etiquetar).toEqual(["manual"]);
  });

  it("un vinculo manual que ya no existe cae al telefono", () => {
    const plan = planDeEtiquetado([demo({ clienteContactId: "borrado" })], [{ id: "c1", waId: "573001112233" }], new Set());
    expect(plan.etiquetar).toEqual(["c1"]);
  });

  it("un demo sin telefono no se puede ubicar y se omite", () => {
    expect(planDeEtiquetado([demo({ waId: null })], [], new Set())).toEqual({ crear: [], etiquetar: [] });
  });

  it("dos demos con el mismo contacto lo etiquetan una sola vez", () => {
    const plan = planDeEtiquetado([demo({ id: "a" }), demo({ id: "b" })], [{ id: "c1", waId: "573001112233" }], new Set());
    expect(plan.etiquetar).toEqual(["c1"]);
  });

  it("varios demos: etiqueta los existentes y crea los que faltan", () => {
    const plan = planDeEtiquetado(
      [demo({ id: "a", waId: "573001112233" }), demo({ id: "b", waId: "573004445566", name: "Otro", persona: null })],
      [{ id: "c1", waId: "573001112233" }],
      new Set()
    );
    expect(plan.etiquetar).toEqual(["c1"]);
    expect(plan.crear).toEqual([{ waId: "573004445566", nombre: "Otro" }]);
  });
});
