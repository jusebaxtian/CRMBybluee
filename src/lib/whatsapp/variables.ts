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

// Approved Meta templates only take NUMBERED {{1}}, {{2}}... placeholders,
// filled at send time via separate "components" — not the free-text
// {{nombre}} token above. Every current caller maps {{1}} in the body (and,
// if present, the one {{1}} a URL button's link is allowed to carry) to the
// contact's name, since that's the variable this feature was built for.
export function buildTemplateSendParams(
  template: {
    variable_count?: number | null;
    buttons?: { type: "URL" | "QUICK_REPLY"; text: string; url?: string }[] | null;
  },
  contact: { name: string | null; wa_id: string }
): {
  bodyParams: string[] | undefined;
  buttonUrlParam: { index: number; value: string } | undefined;
} {
  const contactName = contactDisplayName(contact);
  const bodyParams = (template.variable_count ?? 0) > 0 ? [contactName] : undefined;

  const urlButtonIndex = (template.buttons ?? []).findIndex(
    (b) => b.type === "URL" && b.url?.includes("{{1}}")
  );
  const buttonUrlParam = urlButtonIndex >= 0 ? { index: urlButtonIndex, value: contactName } : undefined;

  return { bodyParams, buttonUrlParam };
}
