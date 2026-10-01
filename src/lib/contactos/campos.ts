/**
 * Los tres campos propios de cada espacio y con qué se rellena cada variable
 * de una plantilla.
 *
 * El problema que resuelve: hasta ahora todas las variables de una plantilla
 * se llenaban con el nombre del contacto, así que una plantilla de dos o tres
 * variables fallaba en cada envío (Meta responde 132000 cuando falta un
 * parámetro). Aquí se define de dónde sale cada una.
 */

export const INDICES_CAMPO = [1, 2, 3] as const;
export type IndiceCampo = (typeof INDICES_CAMPO)[number];

export type TipoCampo = "texto" | "numero" | "fecha";

export type CampoPersonalizado = {
  indice: IndiceCampo;
  nombre: string;
  tipo: TipoCampo;
};

/** De dónde sale el valor de una variable de plantilla. */
export type OrigenVariable = "nombre" | "campo1" | "campo2" | "campo3";

export type VariableDePlantilla = {
  origen: OrigenVariable;
  /** Valor de muestra que se le manda a Meta para aprobar la plantilla. */
  ejemplo?: string;
};

export const ORIGENES: { origen: OrigenVariable; etiqueta: string }[] = [
  { origen: "nombre", etiqueta: "Nombre del contacto" },
  { origen: "campo1", etiqueta: "Columna 1" },
  { origen: "campo2", etiqueta: "Columna 2" },
  { origen: "campo3", etiqueta: "Columna 3" },
];

/** La columna de la tabla `contacts` que corresponde a un origen. */
export function columnaDe(origen: OrigenVariable): "name" | "campo1" | "campo2" | "campo3" {
  return origen === "nombre" ? "name" : origen;
}

/** Nombre que ve el usuario, usando el que el espacio le puso a la columna. */
export function etiquetaDeOrigen(origen: OrigenVariable, campos: CampoPersonalizado[]): string {
  if (origen === "nombre") return "Nombre del contacto";
  const indice = Number(origen.replace("campo", "")) as IndiceCampo;
  const campo = campos.find((c) => c.indice === indice);
  return campo?.nombre?.trim() || `Columna ${indice}`;
}

/** Cuántas variables {{n}} declara un texto de plantilla. */
export function cuantasVariables(texto: string): number {
  const encontradas = texto.match(/\{\{\s*(\d+)\s*\}\}/g) ?? [];
  const numeros = encontradas.map((v) => Number(v.replace(/\D/g, "")));
  return numeros.length === 0 ? 0 : Math.max(...numeros);
}

/**
 * Deja la lista de variables con exactamente el largo que pide el texto.
 *
 * Al editar el cuerpo de una plantilla el número de variables cambia, y el
 * emparejamiento tiene que seguirle el paso sin perder lo ya elegido.
 */
export function ajustarVariables(
  actuales: VariableDePlantilla[],
  cuantas: number
): VariableDePlantilla[] {
  const lista = actuales.slice(0, cuantas);
  while (lista.length < cuantas) {
    // La primera variable casi siempre es el nombre; el resto se deja sin
    // elegir a proposito, para que nadie mande la fecha equivocada por
    // aceptar un valor por defecto.
    lista.push({ origen: lista.length === 0 ? "nombre" : "campo1" });
  }
  return lista;
}

/** Texto plano de un valor de contacto, listo para mandarle a WhatsApp. */
export function valorDeContacto(
  origen: OrigenVariable,
  contacto: { name?: string | null; campo1?: string | null; campo2?: string | null; campo3?: string | null }
): string | null {
  const bruto = origen === "nombre" ? contacto.name : contacto[origen];
  const limpio = (bruto ?? "").toString().replace(/\s+/g, " ").trim();
  return limpio || null;
}

/**
 * Valida un valor contra el tipo declarado de la columna.
 *
 * Devuelve el valor ya normalizado, o un motivo si no sirve. Se usa al
 * importar el Excel: mejor avisar de 30 filas con la fecha mal escrita que
 * descubrirlo cuando el mensaje sale con "Hola Felipe, tu cita es el sdfgh".
 */
export function normalizarValor(
  valor: string,
  tipo: TipoCampo
): { ok: true; valor: string } | { ok: false; motivo: string } {
  const limpio = valor.replace(/\s+/g, " ").trim();
  if (!limpio) return { ok: true, valor: "" };

  if (tipo === "numero") {
    // Se aceptan separadores de miles y coma decimal, que es como los escribe
    // la gente en Colombia; se guarda tal cual lo escribio.
    const soloNumero = limpio.replace(/[.,\s$]/g, "");
    if (!/^\d+$/.test(soloNumero)) {
      return { ok: false, motivo: `"${limpio}" no es un número` };
    }
    return { ok: true, valor: limpio };
  }

  if (tipo === "fecha") {
    // Se guarda el texto que escribio la persona: es lo que va a leer el
    // cliente en el mensaje ("23 de octubre a las 8 pm" es una fecha
    // perfectamente util y ninguna libreria la va a mejorar). Solo se
    // rechaza lo que claramente no dice nada.
    if (limpio.length < 3) return { ok: false, motivo: `"${limpio}" es muy corto para una fecha` };
    return { ok: true, valor: limpio };
  }

  return { ok: true, valor: limpio.slice(0, 200) };
}
