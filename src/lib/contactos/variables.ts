/**
 * Los tres campos propios de cada espacio y con qué se rellena cada variable
 * de una plantilla.
 *
 * El problema que resuelve: hasta ahora todas las variables de una plantilla
 * se llenaban con el nombre del contacto, así que una plantilla de dos o tres
 * variables fallaba en cada envío (Meta responde 132000 cuando falta un
 * parámetro). Aquí se define de dónde sale cada una.
 */

/**
 * Las variables propias son la 2, la 3 y la 4: la {{1}} siempre es el nombre
 * del contacto, que ya existia antes de esto.
 */
export const INDICES_VARIABLE = [2, 3, 4] as const;
export type IndiceVariable = (typeof INDICES_VARIABLE)[number];

export type TipoVariable = "texto" | "numero" | "fecha";

export type VariablePersonalizada = {
  indice: IndiceVariable;
  nombre: string;
  tipo: TipoVariable;
};

/** De dónde sale el valor de una variable de plantilla. */
export type OrigenVariable = "nombre" | "variable2" | "variable3" | "variable4";

export type VariableDePlantilla = {
  origen: OrigenVariable;
  /** Valor de muestra que se le manda a Meta para aprobar la plantilla. */
  ejemplo?: string;
};

export const ORIGENES: OrigenVariable[] = ["nombre", "variable2", "variable3", "variable4"];

/** La columna de la tabla `contacts` que corresponde a un origen. */
export function columnaDe(origen: OrigenVariable): "name" | "variable2" | "variable3" | "variable4" {
  return origen === "nombre" ? "name" : origen;
}

/** El numero de variable de un origen: "variable3" -> 3, "nombre" -> 1. */
export function indiceDe(origen: OrigenVariable): number {
  return origen === "nombre" ? 1 : Number(origen.replace("variable", ""));
}

/**
 * Nombre que ve el usuario.
 *
 * Si el espacio le puso nombre a la variable, ese manda ("Fecha de la cita").
 * Si no, se muestra como "Variable 3", que es como la nombra el cliente
 * cuando escribe {{3}} en la plantilla.
 */
export function etiquetaDeOrigen(origen: OrigenVariable, variables: VariablePersonalizada[]): string {
  if (origen === "nombre") return "Variable 1 · Nombre del contacto";
  const indice = indiceDe(origen) as IndiceVariable;
  const propia = variables.find((v) => v.indice === indice);
  const nombre = propia?.nombre?.trim();
  return nombre ? `Variable ${indice} · ${nombre}` : `Variable ${indice}`;
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
    // La {{1}} es el nombre; a partir de ahi, cada variable propone la suya
    // --{{2}} con variable2, {{3}} con variable3-- que es lo que la gente
    // espera y evita emparejamientos cruzados por despiste.
    const siguiente = lista.length + 1;
    lista.push({ origen: siguiente === 1 ? "nombre" : (`variable${Math.min(siguiente, 4)}` as OrigenVariable) });
  }
  return lista;
}

/** Texto plano de un valor de contacto, listo para mandarle a WhatsApp. */
export function valorDeContacto(
  origen: OrigenVariable,
  contacto: {
    name?: string | null;
    variable2?: string | null;
    variable3?: string | null;
    variable4?: string | null;
  }
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
  tipo: TipoVariable
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
