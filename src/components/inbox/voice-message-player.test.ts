import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { VoiceMessagePlayer } from "@/components/inbox/voice-message-player";

const dibujar = (props: { src: string; tint?: "default" | "outbound"; transcripcion?: string | null }) =>
  renderToStaticMarkup(createElement(VoiceMessagePlayer, props));

describe("VoiceMessagePlayer", () => {
  it("dibuja la onda de 40 barras como un control deslizante accesible", () => {
    const html = dibujar({ src: "https://x/nota-1.ogg" });
    expect(html).toContain('role="slider"');
    expect(html).toContain('aria-label="Posición del audio"');
    // 40 barras de la onda + el punto de la cabeza que sigue la voz.
    expect(html.match(/rounded-full transition-colors/g)).toHaveLength(40);
  });

  it("tiene boton de reproducir y de velocidad", () => {
    const html = dibujar({ src: "https://x/nota-1.ogg" });
    expect(html).toContain('aria-label="Reproducir"');
    expect(html).toContain("Velocidad de reproducción");
    expect(html).toContain("1x");
  });

  it("cada audio dibuja su propia onda, y siempre la misma", () => {
    const a = dibujar({ src: "https://x/a.ogg" });
    expect(a).toBe(dibujar({ src: "https://x/a.ogg" }));
    expect(a).not.toBe(dibujar({ src: "https://x/b.ogg" }));
  });

  it("un audio que llega transcrito muestra el texto y el boton para ocultarlo", () => {
    const html = dibujar({ src: "https://x/a.ogg", transcripcion: "🎙️ Hola, quería saber el precio" });
    expect(html).toContain("Hola, quería saber el precio");
    expect(html).toContain("Ocultar texto");
  });

  it("un audio sin transcripcion no muestra el boton de texto", () => {
    const html = dibujar({ src: "https://x/a.ogg" });
    expect(html).not.toContain("Ocultar texto");
    expect(html).not.toContain("Ver texto");
  });

  it("el audio que envia el equipo usa los colores sobre la burbuja verde", () => {
    const enviado = dibujar({ src: "https://x/a.ogg", tint: "outbound" });
    const recibido = dibujar({ src: "https://x/a.ogg" });
    expect(enviado).toContain("bg-white text-primary");
    expect(enviado).toContain("bg-white/35");
    expect(recibido).toContain("from-primary");
    expect(recibido).toContain("bg-muted/40");
  });
});
