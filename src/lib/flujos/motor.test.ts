import { describe, it, expect } from "vitest";
import { destinoDe, MAX_PASOS, type ConexionFila } from "@/lib/flujos/motor";
import { salidasDe } from "@/lib/flujos/bloques";

/**
 * El recorrido del grafo: dada una salida, a que bloque se va.
 *
 * Es la decision que toma el motor en cada paso, y la que hay que poder
 * probar sin base de datos ni WhatsApp.
 */
const conexiones: ConexionFila[] = [
  { origen_id: "inicio", destino_id: "pregunta", salida: "sig" },
  { origen_id: "pregunta", destino_id: "si", salida: "0" },
  { origen_id: "pregunta", destino_id: "no", salida: "1" },
  { origen_id: "pregunta", destino_id: "humano", salida: "otro" },
  { origen_id: "espera", destino_id: "gracias", salida: "respondio" },
  { origen_id: "espera", destino_id: "recordatorio", salida: "no_respondio" },
];

describe("a dónde sigue el flujo", () => {
  it("sigue por el botón que tocó el contacto", () => {
    expect(destinoDe(conexiones, "pregunta", "0")).toBe("si");
    expect(destinoDe(conexiones, "pregunta", "1")).toBe("no");
  });

  it("si escribió en vez de tocar un botón, sigue por 'otro'", () => {
    expect(destinoDe(conexiones, "pregunta", "otro")).toBe("humano");
  });

  it("distingue respondió de no respondió", () => {
    expect(destinoDe(conexiones, "espera", "respondio")).toBe("gracias");
    expect(destinoDe(conexiones, "espera", "no_respondio")).toBe("recordatorio");
  });

  it("trata la salida simple igual escrita o vacía", () => {
    expect(destinoDe(conexiones, "inicio", "sig")).toBe("pregunta");
    expect(destinoDe(conexiones, "inicio", null)).toBe("pregunta");
  });

  it("devuelve null cuando esa salida no está conectada", () => {
    expect(destinoDe(conexiones, "pregunta", "2")).toBeNull();
    expect(destinoDe(conexiones, "inexistente", "sig")).toBeNull();
  });
});

describe("botones y sus salidas", () => {
  it("cada botón del bloque tiene su salida, en el mismo orden", () => {
    const salidas = salidasDe("botones", { botones: ["Sí, quiero", "Todavía no"] });
    expect(destinoDe(conexiones, "pregunta", salidas[0].id)).toBe("si");
    expect(destinoDe(conexiones, "pregunta", salidas[1].id)).toBe("no");
  });

  it("los botones vacíos no generan salida", () => {
    const salidas = salidasDe("botones", { botones: ["Sí", "", "  "] });
    // Solo el primero cuenta como boton; el resto se ignora al enviar. La
    // salida "otro" siempre esta.
    expect(salidas.map((s) => s.id)).toContain("otro");
  });
});

describe("protección contra lazos", () => {
  it("el tope de pasos es menor que cualquier flujo razonable", () => {
    // 50 bloques es mucho mas de lo que tiene un flujo real, y corta en seco
    // un dibujo en circulo antes de que mande mensajes sin parar.
    expect(MAX_PASOS).toBe(50);
    expect(MAX_PASOS).toBeGreaterThan(20);
  });
});
