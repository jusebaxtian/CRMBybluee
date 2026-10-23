import { describe, it, expect } from "vitest";
import { generarSoporte, formatearMonto, limpiarTexto, type DatosDeSoporte } from "@/lib/soporte/pdf";
import { validarDocumento } from "@/lib/soporte/documento";
import { numeroDeSoporte } from "@/lib/soporte/datos";
import { PDFDocument, StandardFonts } from "pdf-lib";

const BASE: DatosDeSoporte = {
  emisor: { nombre: "Digital Bybluee CRM", correo: "byblueecom@gmail.com", pais: "Colombia" },
  cliente: {
    nombre: "Distribuidora Ñandú & Compañía S.A.S.",
    documentoTipo: "NIT",
    documentoNumero: "900.123.456-7",
    direccion: "Carrera 15 # 93-60, Bogotá",
    correo: "contabilidad@ejemplo.com.co",
    telefono: "+57 311 000 0000",
  },
  pago: {
    numero: "SC-000044",
    fechaPago: new Date("2026-10-01T15:20:00Z"),
    metodo: "Transferencia",
    referencia: "TRX-8842",
    montoCentavos: 16000000,
    moneda: "COP",
    concepto: "Licencia de uso del CRM Bybluee",
  },
};

const comoPdf = async (d: DatosDeSoporte) => PDFDocument.load(await generarSoporte(d));

describe("generarSoporte", () => {
  it("produce un PDF valido de una sola pagina A4", async () => {
    const bytes = await generarSoporte(BASE);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(595);
    expect(Math.round(height)).toBe(842);
  });

  it("no revienta con emoji ni alfabetos que la fuente no tiene", async () => {
    // El nombre del negocio lo escribe el cliente: un emoji o letras de otro
    // alfabeto no pueden tumbar la descarga.
    const raro = { ...BASE, cliente: { ...BASE.cliente, nombre: "Tienda 🚀 Привет 東京 SAS" } };
    await expect(comoPdf(raro)).resolves.toBeTruthy();
  });

  it("cliente sin documento, direccion ni telefono: sigue siendo un PDF valido", async () => {
    const vacio = { ...BASE, cliente: { ...BASE.cliente, documentoTipo: null, documentoNumero: null, direccion: null, telefono: null }, pago: { ...BASE.pago, referencia: null } };
    const doc = await comoPdf(vacio);
    expect(doc.getPageCount()).toBe(1);
  });

  it("textos larguisimos sin espacios no desbordan ni duplican paginas", async () => {
    const largo = "X".repeat(400);
    const extremo = { ...BASE, cliente: { ...BASE.cliente, nombre: largo, correo: `${"a".repeat(200)}@ejemplo.com`, direccion: "Calle ".repeat(60) }, pago: { ...BASE.pago, referencia: "R".repeat(150) } };
    const doc = await comoPdf(extremo);
    expect(doc.getPageCount()).toBe(1);
  });

  it("guarda el numero del soporte en el titulo del documento", async () => {
    const doc = await comoPdf(BASE);
    expect(doc.getTitle()).toContain("SC-000044");
  });
});

describe("limpiarTexto", () => {
  it("conserva tildes y eñes y cambia lo que la fuente no dibuja", async () => {
    const pdf = await PDFDocument.create();
    const f = await pdf.embedFont(StandardFonts.Helvetica);
    expect(limpiarTexto("Ñandú — Compañía", f)).toBe("Ñandú — Compañía");
    expect(limpiarTexto("Hola 🚀 東京", f)).toBe("Hola ? ??");
  });
});

describe("formatearMonto", () => {
  it("pesos colombianos sin decimales", () => {
    expect(formatearMonto(16000000, "COP").replace(/\s/g, " ")).toMatch(/160\.000/);
    expect(formatearMonto(16000000, "COP")).not.toMatch(/,00/);
  });
  it("una moneda con decimales los muestra", () => {
    expect(formatearMonto(12345, "USD")).toMatch(/123,45/);
  });
});

describe("numeroDeSoporte", () => {
  it("rellena con ceros a la izquierda", () => {
    expect(numeroDeSoporte(7)).toBe("SC-000007");
    expect(numeroDeSoporte(123456)).toBe("SC-123456");
  });
});

describe("validarDocumento", () => {
  it("acepta un NIT con puntos y digito de verificacion", () => {
    expect(validarDocumento("NIT", "900.123.456-7", "")).toEqual({ tipo: "NIT", numero: "900.123.456-7", direccion: null });
  });
  it("quita espacios del numero y limpia la direccion", () => {
    expect(validarDocumento("CC", " 1 234 567 890 ", "  Calle 1\n  # 2  ")).toEqual({ tipo: "CC", numero: "1234567890", direccion: "Calle 1 # 2" });
  });
  it("acepta documentos de otros paises", () => {
    expect(validarDocumento("OTRO", "XAXX010101000", "")).toMatchObject({ tipo: "OTRO" });
  });
  it("rechaza tipos inventados, numeros vacios o con simbolos", () => {
    expect("error" in validarDocumento("PASAPORTE", "123456", "")).toBe(true);
    expect("error" in validarDocumento("NIT", "", "")).toBe(true);
    expect("error" in validarDocumento("NIT", "12", "")).toBe(true);
    expect("error" in validarDocumento("CC", "123; DROP TABLE", "")).toBe(true);
    expect("error" in validarDocumento("CC", "<b>123456</b>", "")).toBe(true);
  });
  it("rechaza una direccion de mas de 160 caracteres", () => {
    expect("error" in validarDocumento("NIT", "900123456", "x".repeat(161))).toBe(true);
  });
});
