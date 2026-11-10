import { describe, expect, it } from "vitest";
import { limiteDeBotones, salidasDe, textoDeEspera } from "./bloques";
import { revisarFlujo } from "./validar";

describe("tiempo de espera del mensaje con botones", () => {
  it("vacio: sin salida No respondió, como siempre", () => {
    const ids = salidasDe("botones", { botones: ["Sí", "No"] }).map((s) => s.id);
    expect(ids).toEqual(["0", "1", "otro"]);
    expect(limiteDeBotones({ esperaMinutos: 0 })).toBeNull();
  });
  it("con tiempo: aparece No respondió al final", () => {
    const salidas = salidasDe("botones", { botones: ["Sí"], esperaMinutos: 120, esperaUnidad: "horas" });
    expect(salidas.map((s) => s.id)).toEqual(["0", "otro", "no_respondio"]);
    expect(salidas.at(-1)?.etiqueta).toBe("No respondió");
  });
  it("muestra el tiempo como se escribió", () => {
    expect(textoDeEspera(120, "horas")).toBe("2 horas");
    expect(textoDeEspera(1440, "dias")).toBe("1 día");
    expect(textoDeEspera(30, undefined)).toBe("30 minutos");
  });
  it("tras 24 horas sin responder, solo una plantilla", () => {
    const avisos = revisarFlujo(
      [
        { id: "b", tipo: "botones", datos: { texto: "¿Seguimos?", botones: ["Sí"], esperaMinutos: 1440, esperaUnidad: "dias" } },
        { id: "m", tipo: "mensaje", datos: { texto: "Hola de nuevo" } },
      ],
      [{ origen_id: "b", destino_id: "m", salida: "no_respondio" }]
    );
    expect(avisos.some((a) => a.nodoId === "m" && a.nivel === "error")).toBe(true);
  });
});
