import { describe, it, expect } from "vitest";
import { nombreDeArchivoDeUrl, nombreDeDocumento } from "@/lib/whatsapp/nombre-archivo";

describe("nombre del archivo", () => {
  it("saca el nombre real de la URL de subida", () => {
    expect(
      nombreDeArchivoDeUrl(
        "https://api.crmbybluee.blue/storage/v1/object/public/media/x/templates/1790529418661-Catalogo%20Joyero.pdf"
      )
    ).toBe("Catalogo Joyero.pdf");
  });

  it("quita parametros y anclas", () => {
    expect(nombreDeArchivoDeUrl("https://x/y/1788538242111-Billeteras_catalogo.pdf?token=abc#p=2")).toBe(
      "Billeteras_catalogo.pdf"
    );
  });

  it("deja en paz una URL sin marca de tiempo", () => {
    expect(nombreDeArchivoDeUrl("https://x/y/catalogo.pdf")).toBe("catalogo.pdf");
  });

  it("no confunde un numero que es parte del nombre", () => {
    expect(nombreDeArchivoDeUrl("https://x/y/1790434602177-Lista 2026.pdf")).toBe("Lista 2026.pdf");
  });

  it("devuelve null cuando no hay nada que sacar", () => {
    expect(nombreDeArchivoDeUrl(null)).toBeNull();
    expect(nombreDeArchivoDeUrl("")).toBeNull();
    expect(nombreDeArchivoDeUrl("https://x/y/1790434602177-")).toBeNull();
  });

  it("prefiere el nombre guardado sobre el de la URL", () => {
    expect(nombreDeDocumento("Catálogo oficial.pdf", "https://x/y/123456789012-otro.pdf")).toBe(
      "Catálogo oficial.pdf"
    );
    expect(nombreDeDocumento("   ", "https://x/y/123456789012-otro.pdf")).toBe("otro.pdf");
    expect(nombreDeDocumento(null, null)).toBeUndefined();
  });
});
