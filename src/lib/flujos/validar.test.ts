import { describe, it, expect } from "vitest";
import { revisarFlujo, type ConexionParaValidar, type NodoParaValidar } from "@/lib/flujos/validar";
import { salidasDe } from "@/lib/flujos/bloques";

const inicio: NodoParaValidar = { id: "i", tipo: "inicio", datos: {} };

describe("salidas de un bloque", () => {
  it("un bloque de botones tiene una salida por botón más la de 'otra cosa'", () => {
    const salidas = salidasDe("botones", { botones: ["Sí", "No"] });
    expect(salidas.map((s) => s.id)).toEqual(["0", "1", "otro"]);
    expect(salidas[0].etiqueta).toBe("Sí");
  });

  it("la espera tiene dos caminos", () => {
    expect(salidasDe("esperar", {}).map((s) => s.id)).toEqual(["respondio", "no_respondio"]);
  });

  it("los bloques finales no tienen salida", () => {
    expect(salidasDe("fin", {})).toHaveLength(0);
    expect(salidasDe("ia", {})).toHaveLength(0);
  });
});

describe("revisión del flujo", () => {
  it("un flujo bien armado no da errores", () => {
    const nodos: NodoParaValidar[] = [
      inicio,
      { id: "m", tipo: "mensaje", datos: { texto: "Hola" } },
      { id: "f", tipo: "fin", datos: {} },
    ];
    const conexiones: ConexionParaValidar[] = [
      { origen_id: "i", destino_id: "m", salida: "sig" },
      { origen_id: "m", destino_id: "f", salida: "sig" },
    ];
    expect(revisarFlujo(nodos, conexiones)).toHaveLength(0);
  });

  it("avisa del bloque que quedó suelto", () => {
    const nodos: NodoParaValidar[] = [inicio, { id: "m", tipo: "mensaje", datos: { texto: "Hola" } }];
    const avisos = revisarFlujo(nodos, []);
    expect(avisos.some((a) => a.texto.includes("no está conectado"))).toBe(true);
  });

  it("no deja pasar más botones de los que permite WhatsApp", () => {
    const nodos: NodoParaValidar[] = [
      inicio,
      { id: "b", tipo: "botones", datos: { texto: "¿Cuál?", botones: ["1", "2", "3", "4"] } },
    ];
    const avisos = revisarFlujo(nodos, [{ origen_id: "i", destino_id: "b", salida: "sig" }]);
    expect(avisos.some((a) => a.nivel === "error" && a.texto.includes("3 botones"))).toBe(true);
  });

  it("no deja pasar un botón con título largo", () => {
    const nodos: NodoParaValidar[] = [
      inicio,
      { id: "b", tipo: "botones", datos: { texto: "¿Cuál?", botones: ["Quiero que me llamen ya mismo"] } },
    ];
    const avisos = revisarFlujo(nodos, [{ origen_id: "i", destino_id: "b", salida: "sig" }]);
    expect(avisos.some((a) => a.nivel === "error" && a.texto.includes("20 caracteres"))).toBe(true);
  });

  it("avisa cuando el flujo no termina en ningún lado", () => {
    const nodos: NodoParaValidar[] = [inicio, { id: "m", tipo: "mensaje", datos: { texto: "Hola" } }];
    const conexiones: ConexionParaValidar[] = [{ origen_id: "i", destino_id: "m", salida: "sig" }];
    expect(revisarFlujo(nodos, conexiones).some((a) => a.texto.includes("no termina"))).toBe(true);
  });

  it("marca la espera sin minutos", () => {
    const nodos: NodoParaValidar[] = [inicio, { id: "e", tipo: "esperar", datos: { minutos: 0 } }];
    const avisos = revisarFlujo(nodos, [{ origen_id: "i", destino_id: "e", salida: "sig" }]);
    expect(avisos.some((a) => a.nivel === "error" && a.texto.includes("1 minuto"))).toBe(true);
  });
});
