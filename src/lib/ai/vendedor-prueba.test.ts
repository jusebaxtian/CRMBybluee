import { describe, expect, it } from "vitest";
import { limpiarNumerosDePrueba, vendedorAtiende } from "@/lib/ai/vendedor";

describe("vendedorAtiende", () => {
  const apagado = { activo: false, numeros_prueba: ["573166230373"] };
  it("apagado, solo atiende los numeros de prueba", () => {
    expect(vendedorAtiende(apagado, "573166230373")).toBe(true);
    expect(vendedorAtiende(apagado, "573001112233")).toBe(false);
  });
  it("sin saber quien escribe, apagado no atiende", () => {
    expect(vendedorAtiende(apagado, null)).toBe(false);
    expect(vendedorAtiende(apagado, undefined)).toBe(false);
  });
  it("encendido atiende a todos", () => expect(vendedorAtiende({ ...apagado, activo: true }, "573001112233")).toBe(true));
  it("sin vendedor no atiende", () => expect(vendedorAtiende(null, "573166230373")).toBe(false));
});

describe("limpiarNumerosDePrueba", () => {
  it("acepta como se escriba y agrega el 57", () => {
    expect(limpiarNumerosDePrueba("316 623 0373, +57 300-111-2233")).toEqual(["573166230373", "573001112233"]);
  });
  it("sin repetidos y sin basura", () => {
    expect(limpiarNumerosDePrueba("3166230373\n573166230373, hola, 123")).toEqual(["573166230373"]);
  });
  it("vacio queda vacio", () => expect(limpiarNumerosDePrueba("  ")).toEqual([]));
});

describe("vendedorAtiende: lineas y asesores (0188)", () => {
  const base = { activo: true, numeros_prueba: ["573166230373"], lineas_modo: "todas", lineas_ids: [], asesores_modo: "todos", asesores_ids: [] };

  it("por defecto responde en todas las lineas y todos los chats", () => {
    expect(vendedorAtiende(base, "573001112233", { lineaId: "L1", asignadoA: "u1" })).toBe(true);
  });

  it("solo en las lineas elegidas", () => {
    const v = { ...base, lineas_modo: "seleccionadas", lineas_ids: ["L1"] };
    expect(vendedorAtiende(v, "573001112233", { lineaId: "L1", asignadoA: null })).toBe(true);
    expect(vendedorAtiende(v, "573001112233", { lineaId: "L2", asignadoA: null })).toBe(false);
    expect(vendedorAtiende(v, "573001112233", { lineaId: null })).toBe(false);
  });

  it("solo en los chats de los asesores elegidos, con 'sin asignar' como opcion", () => {
    const v = { ...base, asesores_modo: "seleccionados", asesores_ids: ["u1", "sin_asignar"] };
    expect(vendedorAtiende(v, "573001112233", { lineaId: "L1", asignadoA: "u1" })).toBe(true);
    expect(vendedorAtiende(v, "573001112233", { lineaId: "L1", asignadoA: null })).toBe(true);
    expect(vendedorAtiende(v, "573001112233", { lineaId: "L1", asignadoA: "u2" })).toBe(false);
    const sinSinAsignar = { ...v, asesores_ids: ["u1"] };
    expect(vendedorAtiende(sinSinAsignar, "573001112233", { lineaId: "L1", asignadoA: null })).toBe(false);
  });

  it("sin saber el asesor (bloque de flujo) solo filtra por linea", () => {
    const v = { ...base, asesores_modo: "seleccionados", asesores_ids: ["u1"] };
    expect(vendedorAtiende(v, "573001112233", { lineaId: "L1" })).toBe(true);
  });

  it("los numeros de prueba reciben respuesta aunque esten fuera de la seleccion", () => {
    const v = { ...base, lineas_modo: "seleccionadas", lineas_ids: ["L1"], asesores_modo: "seleccionados", asesores_ids: ["u1"] };
    expect(vendedorAtiende(v, "573166230373", { lineaId: "L2", asignadoA: "u2" })).toBe(true);
    expect(vendedorAtiende({ ...v, activo: false }, "573166230373", { lineaId: "L2", asignadoA: "u2" })).toBe(true);
  });

  it("apagado no responde a nadie mas", () => {
    expect(vendedorAtiende({ ...base, activo: false }, "573001112233", { lineaId: "L1", asignadoA: "u1" })).toBe(false);
  });
});
