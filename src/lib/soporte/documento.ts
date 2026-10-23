/**
 * El documento de quien compra, tal como se pide en el formulario del soporte.
 *
 * Empresa: NIT. Persona natural: cedula (CC) o de extranjeria (CE). OTRO es
 * para clientes de otros paises, que tienen RFC, RUC, RUT, CUIT...: el numero
 * se guarda tal cual lo escribe la persona.
 */

export const TIPOS_DE_DOCUMENTO = [
  { valor: "NIT", etiqueta: "NIT (empresa)" },
  { valor: "CC", etiqueta: "Cédula de ciudadanía (persona natural)" },
  { valor: "CE", etiqueta: "Cédula de extranjería" },
  { valor: "OTRO", etiqueta: "Otro documento (RFC, RUC, RUT, CUIT…)" },
] as const;

export type TipoDeDocumento = (typeof TIPOS_DE_DOCUMENTO)[number]["valor"];

export type DatosDeDocumento = { tipo: TipoDeDocumento; numero: string; direccion: string | null };

export function validarDocumento(
  tipo: string,
  numero: string,
  direccion: string
): { error: string } | DatosDeDocumento {
  if (!TIPOS_DE_DOCUMENTO.some((t) => t.valor === tipo)) return { error: "Elige el tipo de documento." };

  const limpio = numero.replace(/\s+/g, "").trim();
  if (!limpio) return { error: "Escribe el número de documento." };
  // Letras, numeros, puntos y guion: cubre un NIT con su digito de verificacion
  // (900.123.456-7) y los documentos de otros paises. Nada mas, porque este
  // texto termina impreso en un PDF.
  if (!/^[0-9A-Za-z.\-]{4,20}$/.test(limpio)) {
    return { error: "El número de documento solo puede llevar letras, números, puntos y guion (entre 4 y 20 caracteres)." };
  }

  // eslint-disable-next-line no-control-regex
  const dir = direccion.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (dir.length > 160) return { error: "La dirección es muy larga (máximo 160 caracteres)." };

  return { tipo: tipo as TipoDeDocumento, numero: limpio, direccion: dir || null };
}

export type DatosLegales = DatosDeDocumento & { razonSocial: string; direccion: string };

/**
 * Los cuatro datos legales que registra una empresa: razon social, tipo y
 * numero de documento, y direccion. Los cuatro son obligatorios: una vez
 * guardados el cliente ya no los puede cambiar, asi que no se acepta a medias.
 */
export function validarDatosLegales(
  razonSocial: string,
  tipo: string,
  numero: string,
  direccion: string
): { error: string } | DatosLegales {
  // eslint-disable-next-line no-control-regex
  const nombre = razonSocial.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (nombre.length < 3) return { error: "Escribe el nombre o la razón social de tu empresa." };
  if (nombre.length > 120) return { error: "El nombre o la razón social es muy largo (máximo 120 caracteres)." };

  const doc = validarDocumento(tipo, numero, direccion);
  if ("error" in doc) return doc;
  if (!doc.direccion || doc.direccion.length < 5) return { error: "Escribe la dirección de tu empresa." };

  return { razonSocial: nombre, tipo: doc.tipo, numero: doc.numero, direccion: doc.direccion };
}
