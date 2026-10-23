import { beforeAll, describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { HojaDeAdjunto } from "@/components/inbox/message-composer";

const MB = 1024 * 1024;

// Node no sabe hacer una URL de vista previa para un archivo simulado: se sustituye.
beforeAll(() => {
  URL.createObjectURL = () => "blob:prueba";
  URL.revokeObjectURL = () => {};
});
const archivo = (nombre: string, tipo: string, bytes: number) => {
  const f = new File(["x"], nombre, { type: tipo });
  Object.defineProperty(f, "size", { value: bytes });
  return f;
};
const dibujar = (f: File, texto = "") =>
  renderToStaticMarkup(
    createElement(HojaDeAdjunto, { archivo: f, posicion: 1, total: 1, texto, onTexto: () => {}, onEnviar: () => {}, onCancelar: () => {}, onCambiar: () => {} })
  );

describe("HojaDeAdjunto", () => {
  it("un PDF muestra su ficha, el nombre, el peso, el campo de texto y el boton de enviar activo", () => {
    const html = dibujar(archivo("catalogo-octubre.pdf", "application/pdf", 1.2 * MB));
    expect(html).toContain("catalogo-octubre.pdf");
    expect(html).toContain("1,2 MB");
    expect(html).toContain(">PDF<");
    expect(html).toContain("Añade un texto a este archivo");
    expect(html).toContain("Cambiar");
    expect(html).toContain("Cancelar");
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>[^<]*<svg[^>]*>.*?<\/svg>Enviar/);
    expect(html).not.toContain('role="alert"');
  });

  it("una imagen muestra su vista previa", () => {
    const html = dibujar(archivo("taladro.jpg", "image/jpeg", 2.4 * MB));
    expect(html).toContain("<img");
    expect(html).toContain("Vista previa de taladro.jpg");
  });

  it("un video muestra su reproductor con controles", () => {
    const html = dibujar(archivo("demo.mp4", "video/mp4", 9.8 * MB));
    expect(html).toContain("<video");
    expect(html).toContain("controls");
  });

  it("una imagen que pesa de mas muestra el motivo y apaga Enviar", () => {
    const html = dibujar(archivo("fachada.jpg", "image/jpeg", 7.3 * MB));
    expect(html).toContain('role="alert"');
    expect(html).toContain("5MB");
    expect(html).toMatch(/disabled=""[^>]*>(?:<svg.*?<\/svg>)?Enviar/);
  });

  it("un WebP se rechaza antes de enviar", () => {
    const html = dibujar(archivo("promo.webp", "image/webp", 300 * 1024));
    expect(html).toContain('role="alert"');
    expect(html).toContain("WhatsApp solo acepta");
  });

  it("un video grande avisa que se comprimira, pero deja enviar", () => {
    const html = dibujar(archivo("recorrido.mp4", "video/mp4", 41 * MB));
    expect(html).toContain('role="status"');
    expect(html).toContain("comprimirá");
    expect(html).not.toMatch(/disabled=""[^>]*>(?:<svg.*?<\/svg>)?Enviar/);
  });

  it("un texto de mas de 1.024 caracteres apaga Enviar y muestra el contador", () => {
    const html = dibujar(archivo("a.pdf", "application/pdf", MB), "x".repeat(1100));
    expect(html).toContain("1100 / 1024");
    expect(html).toMatch(/disabled=""[^>]*>(?:<svg.*?<\/svg>)?Enviar/);
  });

  it("un audio no ofrece campo de texto", () => {
    const html = dibujar(archivo("nota.mp3", "audio/mpeg", MB));
    expect(html).toContain("Los audios se envían sin texto");
    expect(html).not.toContain("<textarea");
  });

  it("con varios archivos por revisar dice cual es", () => {
    const html = renderToStaticMarkup(
      createElement(HojaDeAdjunto, { archivo: archivo("a.pdf", "application/pdf", MB), posicion: 1, total: 3, texto: "", onTexto: () => {}, onEnviar: () => {}, onCancelar: () => {}, onCambiar: () => {} })
    );
    expect(html).toContain("1 de 3");
  });
});
