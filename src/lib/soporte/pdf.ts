import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/**
 * La cuenta de cobro en PDF.
 *
 * Es el respaldo que se le entrega al cliente por un pago aprobado. Se titula
 * "Cuenta de cobro" y no "factura": no la emite un sistema de facturacion
 * electronica.
 *
 * Este archivo no importa nada del proyecto a proposito: asi se puede ejecutar
 * suelto para mirar el resultado, y las pruebas no necesitan montar Next.
 */

export type DatosDeSoporte = {
  emisor: { nombre: string; correo: string; pais: string; documento?: string };
  cliente: {
    nombre: string;
    documentoTipo: string | null;
    documentoNumero: string | null;
    direccion: string | null;
    correo: string | null;
    telefono: string | null;
  };
  pago: {
    /** Consecutivo del pago: SC-000123. */
    numero: string;
    fechaPago: Date;
    metodo: string;
    referencia: string | null;
    /** En la unidad menor de la moneda (centavos). */
    montoCentavos: number;
    moneda: string;
    concepto: string;
  };
};

const TIPOS_DE_DOCUMENTO: Record<string, string> = { NIT: "NIT", CC: "C.C.", CE: "C.E.", OTRO: "Documento" };

// Colores: el verde de la marca para el titulo y las lineas, tinta casi negra
// para el texto, y un gris verdoso para lo secundario.
const VERDE = rgb(0.078, 0.533, 0.235);
const VERDE_SUAVE = rgb(0.89, 0.953, 0.91);
const TINTA = rgb(0.067, 0.11, 0.082);
const GRIS = rgb(0.365, 0.431, 0.388);
const REGLA = rgb(0.859, 0.894, 0.871);

const MARGEN = 48;
const ANCHO = 595.28; // A4
const ALTO = 841.89;

/**
 * Las fuentes estandar de PDF solo codifican Latin-1 y unos pocos signos mas.
 * Un nombre con un emoji o con caracteres de otro alfabeto haria fallar la
 * generacion entera, y el nombre de un negocio lo escribe el cliente. Lo que
 * la fuente no puede dibujar se cambia por "?".
 */
export function limpiarTexto(texto: string, fuente: PDFFont): string {
  const soportados = new Set(fuente.getCharacterSet());
  let salida = "";
  for (const ch of texto.replace(/\s+/g, " ").trim()) {
    const cp = ch.codePointAt(0) as number;
    salida += soportados.has(cp) ? ch : "?";
  }
  return salida;
}

/** Parte un texto en lineas que quepan en `ancho`. */
function envolver(texto: string, fuente: PDFFont, tamano: number, ancho: number): string[] {
  const palabras = texto.split(" ");
  const lineas: string[] = [];
  let actual = "";
  for (const palabra of palabras) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (fuente.widthOfTextAtSize(prueba, tamano) <= ancho) {
      actual = prueba;
      continue;
    }
    if (actual) lineas.push(actual);
    // Una palabra sola mas ancha que la columna (un correo largo): se corta.
    let resto = palabra;
    while (fuente.widthOfTextAtSize(resto, tamano) > ancho && resto.length > 1) {
      let n = resto.length;
      while (n > 1 && fuente.widthOfTextAtSize(resto.slice(0, n), tamano) > ancho) n -= 1;
      lineas.push(resto.slice(0, n));
      resto = resto.slice(n);
    }
    actual = resto;
  }
  if (actual) lineas.push(actual);
  return lineas.length ? lineas : [""];
}

export function formatearMonto(centavos: number, moneda: string): string {
  const sinDecimales = moneda === "COP" || moneda === "CLP";
  const valor = centavos / 100;
  try {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: moneda,
      minimumFractionDigits: sinDecimales ? 0 : 2,
      maximumFractionDigits: sinDecimales ? 0 : 2,
    }).format(valor);
  } catch {
    return `${moneda} ${valor.toFixed(sinDecimales ? 0 : 2)}`;
  }
}

function fechaLarga(d: Date): string {
  return d.toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "2-digit", month: "long", year: "numeric" });
}

export async function generarSoporte(datos: DatosDeSoporte): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Cuenta de cobro ${datos.pago.numero}`);
  pdf.setAuthor(datos.emisor.nombre);
  pdf.setSubject("Cuenta de cobro");
  const page: PDFPage = pdf.addPage([ANCHO, ALTO]);
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);

  const t = (s: string, f: PDFFont = normal) => limpiarTexto(s, f);
  const texto = (s: string, x: number, y: number, tamano: number, fuente: PDFFont, color = TINTA) =>
    page.drawText(t(s, fuente), { x, y, size: tamano, font: fuente, color });
  const derecha = (s: string, xDer: number, y: number, tamano: number, fuente: PDFFont, color = TINTA) => {
    const limpio = t(s, fuente);
    page.drawText(limpio, { x: xDer - fuente.widthOfTextAtSize(limpio, tamano), y, size: tamano, font: fuente, color });
  };
  const linea = (y: number, grosor = 0.8, color = REGLA) =>
    page.drawLine({ start: { x: MARGEN, y }, end: { x: ANCHO - MARGEN, y }, thickness: grosor, color });

  // ---- Encabezado ----------------------------------------------------------
  let y = ALTO - MARGEN - 8;
  texto(datos.emisor.nombre, MARGEN, y, 18, negrita);
  derecha("CUENTA DE COBRO", ANCHO - MARGEN, y, 15, negrita, VERDE);
  y -= 17;
  const emisor = [datos.emisor.documento, datos.emisor.pais, datos.emisor.correo].filter(Boolean).join("  ·  ");
  texto(emisor, MARGEN, y, 9.5, normal, GRIS);
  derecha(`N.º ${datos.pago.numero}`, ANCHO - MARGEN, y, 10.5, negrita);
  y -= 13;
  derecha(fechaLarga(datos.pago.fechaPago), ANCHO - MARGEN, y, 9.5, normal, GRIS);
  y -= 14;
  linea(y, 2.2, VERDE);

  // ---- Cliente y datos del pago ---------------------------------------------
  y -= 26;
  const colDer = MARGEN + (ANCHO - 2 * MARGEN) / 2 + 12;
  const anchoCol = (ANCHO - 2 * MARGEN) / 2 - 12;
  texto("CLIENTE", MARGEN, y, 8, negrita, VERDE);
  texto("DATOS DEL PAGO", colDer, y, 8, negrita, VERDE);

  const c = datos.cliente;
  const izq: { s: string; f: PDFFont; tam: number; color?: ReturnType<typeof rgb> }[] = [];
  for (const l of envolver(t(c.nombre, negrita), negrita, 11.5, anchoCol)) izq.push({ s: l, f: negrita, tam: 11.5 });
  if (c.documentoNumero) {
    const etiqueta = TIPOS_DE_DOCUMENTO[c.documentoTipo ?? ""] ?? "Documento";
    izq.push({ s: `${etiqueta} ${c.documentoNumero}`, f: normal, tam: 10 });
  }
  for (const campo of [c.direccion, c.correo, c.telefono]) {
    if (!campo) continue;
    for (const l of envolver(t(campo, normal), normal, 10, anchoCol)) izq.push({ s: l, f: normal, tam: 10, color: GRIS });
  }

  const p = datos.pago;
  const der: [string, string][] = [
    ["Método", p.metodo],
    ["Fecha del pago", fechaLarga(p.fechaPago)],
  ];
  if (p.referencia) der.push(["Referencia", p.referencia]);
  der.push(["Estado", "Pagado"]);

  let yIzq = y - 17;
  for (const l of izq) {
    texto(l.s, MARGEN, yIzq, l.tam, l.f, l.color ?? TINTA);
    yIzq -= l.tam + 4;
  }
  let yDer = y - 17;
  for (const [k, v] of der) {
    texto(k, colDer, yDer, 9, normal, GRIS);
    const valores = envolver(t(v, negrita), negrita, 10, anchoCol - 82);
    valores.forEach((vl, i) => texto(vl, colDer + 82, yDer - i * 13, 10, negrita));
    yDer -= 15 + (valores.length - 1) * 13;
  }
  y = Math.min(yIzq, yDer) - 8;

  // ---- Concepto -------------------------------------------------------------
  y -= 10;
  page.drawRectangle({ x: MARGEN, y: y - 6, width: ANCHO - 2 * MARGEN, height: 22, color: VERDE_SUAVE });
  texto("DESCRIPCIÓN", MARGEN + 8, y, 8, negrita, VERDE);
  derecha("VALOR", ANCHO - MARGEN - 8, y, 8, negrita, VERDE);
  y -= 26;
  const conceptoLineas = envolver(t(p.concepto, normal), normal, 11, ANCHO - 2 * MARGEN - 150);
  conceptoLineas.forEach((l, i) => texto(l, MARGEN + 8, y - i * 14, 11, normal));
  derecha(formatearMonto(p.montoCentavos, p.moneda), ANCHO - MARGEN - 8, y, 11, normal);
  y -= (conceptoLineas.length - 1) * 14 + 16;
  linea(y);

  // ---- Total ----------------------------------------------------------------
  y -= 34;
  texto("TOTAL PAGADO", ANCHO - MARGEN - 250, y + 3, 9, negrita, GRIS);
  derecha(formatearMonto(p.montoCentavos, p.moneda), ANCHO - MARGEN, y, 22, negrita);
  derecha(p.moneda, ANCHO - MARGEN, y - 15, 9, normal, GRIS);

  // ---- Pie -------------------------------------------------------------------
  const nota =
    "Esta cuenta de cobro acredita que el pago fue recibido y aprobado por " +
    datos.emisor.nombre +
    ".";
  const yPie = MARGEN + 30;
  linea(yPie + 16);
  const notaLineas = envolver(t(nota, normal), normal, 8.5, ANCHO - 2 * MARGEN);
  notaLineas.forEach((l, i) => texto(l, MARGEN, yPie - i * 11, 8.5, normal, GRIS));

  return pdf.save();
}
