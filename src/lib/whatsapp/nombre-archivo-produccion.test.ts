import { describe, it, expect } from "vitest";
import { nombreDeArchivoDeUrl } from "@/lib/whatsapp/nombre-archivo";

describe("URLs reales de produccion", () => {
  it("catalogo de Zelika (plantilla)", () => {
    expect(
      nombreDeArchivoDeUrl(
        "https://api.crmbybluee.blue/storage/v1/object/public/chat-media/e5ab5a6b-5aa8-46e4-850e-b16f5b904ccf/templates/1790529418661-Catalogo%20Joyero.pdf"
      )
    ).toBe("Catalogo Joyero.pdf");
  });
  it("catalogo con nombre largo", () => {
    expect(
      nombreDeArchivoDeUrl(
        "https://api.crmbybluee.blue/storage/v1/object/public/chat-media/x/templates/1790529418661-Catalogo%20Productos%20de%20la%20semana.pdf"
      )
    ).toBe("Catalogo Productos de la semana.pdf");
  });
  it("PDF de automatizacion de Ludisa", () => {
    expect(
      nombreDeArchivoDeUrl(
        "https://api.crmbybluee.blue/storage/v1/object/public/chat-media/x/automations/1788538242111-Billeteras_catalogo_comprimido.pdf"
      )
    ).toBe("Billeteras_catalogo_comprimido.pdf");
  });
});
