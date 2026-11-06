import { describe, expect, it } from "vitest";
import { decidirAudio, MAX_CARACTERES_AUDIO, textoParaVoz } from "@/lib/ai/voz-texto";

const LARGA = "Mira, por lo que me cuentas se te están quedando clientes sin respuesta, y justo eso es lo que resuelve el agente, porque atiende de día y de noche mientras tú estás en la tienda vendiendo.";
const normal = { clienteMandoAudio: false, audioReciente: false };

describe("decidirAudio", () => {
  it("una explicacion larga sale en audio", () => {
    expect(decidirAudio(LARGA, normal)).toEqual({ audio: LARGA, texto: "" });
  });
  it("un saludo corto sale escrito", () => {
    expect(decidirAudio("¡Hola! ¿Qué vendes?", normal).audio).toBeNull();
  });
  it("si el cliente mando audio, se le contesta en audio aunque sea corto", () => {
    expect(decidirAudio("Claro, cuéntame qué vendes y cómo atiendes hoy", { clienteMandoAudio: true, audioReciente: false }).audio).not.toBeNull();
  });
  it("no manda dos audios seguidos sin que el cliente haya mandado uno", () => {
    expect(decidirAudio(LARGA, { clienteMandoAudio: false, audioReciente: true }).audio).toBeNull();
  });
  it("si el cliente sigue mandando audios, sigue en audio", () => {
    expect(decidirAudio(LARGA, { clienteMandoAudio: true, audioReciente: true }).audio).toBe(LARGA);
  });
  it("precios y enlaces quedan escritos", () => {
    const r = decidirAudio(`${LARGA}\nEl PRO vale $120.000 al mes\nMira https://crmbybluee.blue`, normal);
    expect(r.audio).toBe(LARGA);
    expect(r.texto).toBe("El PRO vale $120.000 al mes\nMira https://crmbybluee.blue");
  });
  it("con un adjunto va escrito", () => {
    expect(decidirAudio(LARGA, { ...normal, llevaAdjunto: true }).audio).toBeNull();
  });
  it("un numero corto no obliga a escribir la linea", () => {
    expect(decidirAudio(`${LARGA} Atiende 24/7 y hasta 3 números.`, normal).texto).toBe("");
  });
  it("demasiado largo sale escrito completo", () => {
    const larguisima = "palabra ".repeat(100);
    expect(decidirAudio(larguisima, normal)).toEqual({ audio: null, texto: larguisima.trim() });
  });
});

describe("textoParaVoz", () => {
  it("quita lo que no se puede leer en voz alta", () => {
    expect(textoParaVoz("*Mira* 🙌 entra a https://crmbybluee.blue  ya")).toBe("Mira entra a ya");
  });
  it("respeta el maximo", () => {
    expect(textoParaVoz("a".repeat(MAX_CARACTERES_AUDIO + 1))).toBeNull();
    expect(textoParaVoz("a".repeat(MAX_CARACTERES_AUDIO))).not.toBeNull();
  });
  it("sin nada que decir, no hay audio", () => expect(textoParaVoz("🙌 https://x.co")).toBeNull());
});
