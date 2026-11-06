import { describe, expect, it } from "vitest";
import { nombreDeBloque, opcionesDeAvance } from "@/lib/flujos/gestion";

const nodos = [
  { id: "ini", tipo: "inicio" as const, datos: {} },
  { id: "pre", tipo: "botones" as const, datos: { texto: "¿Te aparto un cupo?", botones: ["Sí", "No"] } },
  { id: "si", tipo: "mensaje" as const, datos: { texto: "Listo" } },
  { id: "no", tipo: "fin" as const, datos: {} },
  { id: "suelto", tipo: "mensaje" as const, datos: { texto: "Sin conectar" } },
];
const conexiones = [
  { origen_id: "ini", destino_id: "pre", salida: "sig" },
  { origen_id: "pre", destino_id: "si", salida: "0" },
  { origen_id: "pre", destino_id: "no", salida: "1" },
];

describe("opcionesDeAvance", () => {
  it("primero las salidas conectadas, con su nombre", () => {
    const o = opcionesDeAvance("pre", nodos, conexiones);
    expect(o[0]).toEqual({ destinoId: "si", etiqueta: "Sí → Mensaje: Listo", porSalida: true });
    expect(o[1].destinoId).toBe("no");
    expect(o[1].porSalida).toBe(true);
  });
  it("despues cualquier otro bloque", () => {
    expect(opcionesDeAvance("pre", nodos, conexiones).filter((x) => !x.porSalida).map((x) => x.destinoId)).toEqual(["suelto"]);
  });
  it("nunca ofrece el inicio ni el bloque donde ya esta", () => {
    const ids = opcionesDeAvance("pre", nodos, conexiones).map((x) => x.destinoId);
    expect(ids).not.toContain("ini");
    expect(ids).not.toContain("pre");
  });
  it("quien perdio su bloque puede ir a cualquiera menos al inicio", () => {
    const o = opcionesDeAvance(null, nodos, conexiones);
    expect(o.map((x) => x.destinoId)).toEqual(["pre", "si", "no", "suelto"]);
    expect(o.every((x) => !x.porSalida)).toBe(true);
  });
  it("un bloque conectado dos veces sale una sola vez", () => {
    const dobles = [...conexiones, { origen_id: "pre", destino_id: "si", salida: "otro" }];
    expect(opcionesDeAvance("pre", nodos, dobles).filter((x) => x.destinoId === "si")).toHaveLength(1);
  });
});

describe("nombreDeBloque", () => {
  it("recorta los textos largos y en una sola linea", () => {
    const n = nombreDeBloque({ id: "x", tipo: "mensaje", datos: { texto: `linea uno\n${"a".repeat(80)}` } });
    expect(n.startsWith("Mensaje: linea uno a")).toBe(true);
    expect(n.endsWith("…")).toBe(true);
    expect(n).not.toContain("\n");
  });
});
