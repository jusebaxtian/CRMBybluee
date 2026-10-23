import { describe, it, expect } from "vitest";
import { LARGO_MAXIMO_DEL_TEXTO, extensionDe, pesoLegible, revisarAdjunto } from "@/lib/whatsapp/revisar-adjunto";

const MB = 1024 * 1024;

describe("revisarAdjunto", () => {
  it("una foto JPG normal se puede enviar", () => {
    const r = revisarAdjunto({ type: "image/jpeg", size: 2.4 * MB }, "");
    expect(r).toMatchObject({ tipo: "image", error: null, aviso: null, admiteTexto: true });
  });

  it("una imagen de mas de 5 MB no se envia y dice cuanto pesa", () => {
    const r = revisarAdjunto({ type: "image/png", size: 7.3 * MB }, "");
    expect(r.error).toContain("7.3MB");
    expect(r.error).toContain("5MB");
  });

  it("WebP y GIF no se aceptan como imagen", () => {
    expect(revisarAdjunto({ type: "image/webp", size: 100 * 1024 }, "").error).toContain("WhatsApp solo acepta");
    expect(revisarAdjunto({ type: "image/gif", size: 100 * 1024 }, "").error).not.toBeNull();
  });

  it("un video grande se avisa pero no se bloquea: se comprime en el servidor", () => {
    const r = revisarAdjunto({ type: "video/mp4", size: 41 * MB }, "");
    expect(r.error).toBeNull();
    expect(r.aviso).toContain("comprimirá");
  });

  it("un video pequeño no avisa nada", () => {
    expect(revisarAdjunto({ type: "video/mp4", size: 9.8 * MB }, "")).toMatchObject({ error: null, aviso: null });
  });

  it("un documento de mas de 100 MB no se envia", () => {
    expect(revisarAdjunto({ type: "application/zip", size: 120 * MB }, "").error).toContain("100MB");
  });

  it("los documentos comunes pasan: PDF, Excel, Word, ZIP", () => {
    for (const type of [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/zip",
    ]) {
      expect(revisarAdjunto({ type, size: 1 * MB }, "").error).toBeNull();
    }
  });

  it("un tipo que WhatsApp no acepta se rechaza con el motivo", () => {
    // Sin tipo conocido tambien se rechaza: es lo mismo que haria el servidor al enviarlo.
    expect(revisarAdjunto({ type: "", size: 1 * MB }, "").error).not.toBeNull();
    expect(revisarAdjunto({ type: "application/x-msdownload", size: 1 * MB }, "").error).toContain("WhatsApp solo acepta");
  });

  it("un archivo vacio no se envia", () => {
    expect(revisarAdjunto({ type: "application/pdf", size: 0 }, "").error).toBe("El archivo está vacío.");
  });

  it("el texto pasa hasta 1.024 caracteres y no mas", () => {
    expect(revisarAdjunto({ type: "image/jpeg", size: MB }, "x".repeat(LARGO_MAXIMO_DEL_TEXTO)).error).toBeNull();
    const r = revisarAdjunto({ type: "image/jpeg", size: MB }, "x".repeat(LARGO_MAXIMO_DEL_TEXTO + 1));
    expect(r.error).toContain("1025");
    expect(r.error).toContain("1024");
  });

  it("el audio no admite texto", () => {
    expect(revisarAdjunto({ type: "audio/mpeg", size: MB }, "").admiteTexto).toBe(false);
  });
});

describe("pesoLegible", () => {
  it("escribe MB con coma y KB enteros", () => {
    expect(pesoLegible(2.4 * MB)).toBe("2,4 MB");
    expect(pesoLegible(88 * 1024)).toBe("88 KB");
    expect(pesoLegible(41 * MB)).toBe("41 MB");
    expect(pesoLegible(10)).toBe("1 KB");
  });
});

describe("extensionDe", () => {
  it("saca la extension para la ficha del documento", () => {
    expect(extensionDe("catalogo-octubre.pdf")).toBe("PDF");
    expect(extensionDe("lista.de.precios.xlsx")).toBe("XLSX");
    expect(extensionDe("sin-extension")).toBe("ARCHIVO");
  });
});
