import { valorDeContacto, type OrigenVariable, type VariableDePlantilla } from "@/lib/contactos/variables";

// Con qué se rellena {{1}} / {{nombre}} cuando el contacto no tiene un nombre
// aprovechable. No puede quedar vacío: si la plantilla declara una variable,
// Meta rechaza el envío con el error 132000 cuando el parámetro va en blanco.
const NOMBRE_GENERICO = "que tal";

// El "nombre" de un contacto es el del perfil de WhatsApp, y la gente pone ahí
// lo que quiera: emojis, símbolos o su propio número. Antes se metía tal cual
// en el saludo y salían mensajes como "Hola ✌🏻 👋" o "Hola 573219255526 👋".
// Se considera usable solo si tiene al menos una letra.
function isUsableName(name: string | null): name is string {
  return !!name && /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(name);
}

// Meta rechaza un parámetro de plantilla que traiga saltos de línea, tabs o
// más de cuatro espacios seguidos, así que el nombre se aplana antes de usarlo.
function sanitizeParam(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 200);
}

/**
 * El texto que va en el saludo: el nombre del contacto si sirve, o el genérico.
 * Ya no cae al número de teléfono — verlo en un saludo delata que es un envío
 * automático y queda peor que una palabra neutra.
 */
export function contactDisplayName(contact: { name: string | null; wa_id: string }): string {
  return isUsableName(contact.name) ? sanitizeParam(contact.name) : NOMBRE_GENERICO;
}

// Shared variable substitution for free-form text (automations, quick
// replies, campaigns) — a literal {{nombre}} token in the text gets
// replaced with the contact's name. Case-insensitive so "{{Nombre}}" also
// works. {{1}} is also accepted as an alias — people used to filling in
// approved templates' numbered {{1}} reach for it out of habit in free-text
// sends too.
export function substituteContactVariables(
  text: string,
  contact: { name: string | null; wa_id: string }
): string {
  const name = contactDisplayName(contact);
  return text
    .replace(/\{\{\s*nombre\s*\}\}/gi, name)
    .replace(/\{\{\s*1\s*\}\}/g, name);
}

/**
 * Rellena las variables numeradas de una plantilla aprobada.
 *
 * Antes se mandaba SIEMPRE el nombre del contacto, una sola vez: una plantilla
 * con dos o tres variables fallaba en cada envio, porque Meta responde 132000
 * cuando falta un parametro. Ahora cada variable toma el dato con el que se
 * emparejo al crear la plantilla (`variables_origen`): el nombre, o una de las
 * tres columnas propias del espacio.
 *
 * Cuando la plantilla no tiene emparejamiento guardado --las creadas antes de
 * esto-- se mantiene el comportamiento viejo: todas al nombre. Cambiarlo por
 * sorpresa habria roto envios que hoy funcionan.
 *
 * `faltan` sale con los datos que el contacto no tiene. Quien envia decide que
 * hacer: la campaña lo salta y lo marca, en vez de mandar "tu cita es el" a
 * medias.
 */
export function buildTemplateSendParams(
  template: {
    variable_count?: number | null;
    buttons?: { type: "URL" | "QUICK_REPLY"; text: string; url?: string }[] | null;
    variables_origen?: VariableDePlantilla[] | null;
  },
  contact: {
    name: string | null;
    wa_id: string;
    variable2?: string | null;
    variable3?: string | null;
    variable4?: string | null;
  }
): {
  bodyParams: string[] | undefined;
  buttonUrlParam: { index: number; value: string } | undefined;
  faltan: OrigenVariable[];
} {
  const contactName = contactDisplayName(contact);
  const cuantas = template.variable_count ?? 0;
  const emparejamiento = template.variables_origen ?? null;
  const faltan: OrigenVariable[] = [];

  let bodyParams: string[] | undefined;
  if (cuantas > 0) {
    if (!emparejamiento || emparejamiento.length === 0) {
      bodyParams = [contactName];
    } else {
      bodyParams = [];
      for (let i = 0; i < cuantas; i += 1) {
        const origen = emparejamiento[i]?.origen ?? "nombre";
        if (origen === "nombre") {
          bodyParams.push(contactName);
          continue;
        }
        const valor = valorDeContacto(origen, contact);
        if (!valor) {
          faltan.push(origen);
          // Se mete algo para no dejar el array corto: si el que llama decide
          // enviar igual, al menos no revienta con un error incomprensible.
          bodyParams.push("");
          continue;
        }
        bodyParams.push(sanitizeParam(valor));
      }
    }
  }

  const urlButtonIndex = (template.buttons ?? []).findIndex(
    (b) => b.type === "URL" && b.url?.includes("{{1}}")
  );
  const buttonUrlParam = urlButtonIndex >= 0 ? { index: urlButtonIndex, value: contactName } : undefined;

  return { bodyParams, buttonUrlParam, faltan };
}
