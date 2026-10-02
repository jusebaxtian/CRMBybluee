import {
  cuantasVariables,
  normalizarVariables,
  variablesSaltadas,
  type VariableDePlantilla,
} from "@/lib/contactos/variables";
import { noSePuedeUsar, motivoDelExceso } from "@/lib/whatsapp/limite-plantilla";

/**
 * Las reglas de una plantilla antes de mandarla a Meta, en un solo sitio.
 *
 * Por qué existe este archivo. Había dos caminos para crear una plantilla: la
 * acción de servidor `createTemplate` y la ruta `/api/create-template`. El
 * formulario siempre usó la ruta --necesita XHR para mostrar el progreso de
 * subida del encabezado-- y la acción quedó sin un solo llamador, pero fue en
 * la acción donde se escribieron el emparejamiento de variables, el límite de
 * 1.024 caracteres y la numeración sin huecos.
 *
 * El resultado: nada de eso corrió nunca en producción. El 1 oct 2026
 * ConexionFit Colombia creó una plantilla de confirmación de cita con dos
 * variables; se guardó sin emparejamiento y cada envío murió con el 132000 de
 * Meta ("la plantilla espera otra cantidad de datos"). Las 62 plantillas con
 * variables que ya existían estaban igual.
 *
 * Ahora la validación vive aquí y la ruta la usa. La acción duplicada se
 * borró: dos copias de la misma regla vuelven a separarse, es solo cuestión
 * de tiempo.
 */

export type PlantillaValidada = {
  /** El cuerpo ya canónico: "{{ 2 }}" queda como "{{2}}". */
  bodyText: string;
  /** Cuántas variables declara, contadas por el índice más alto. */
  variableCount: number;
  /** Con qué se rellena cada una al enviar, en orden. */
  variables: VariableDePlantilla[];
  /** El valor de muestra de cada variable, para el revisor de Meta. */
  ejemplos: string[];
};

/**
 * Revisa el cuerpo y su emparejamiento. Devuelve el error ya redactado para
 * el cliente, o la plantilla lista para crear.
 */
export function validarPlantilla(
  bodyTextCrudo: string,
  variablesJson: string
): { error: string } | PlantillaValidada {
  // Se normaliza antes de todo: así el texto que se valida, el que viaja a
  // Meta y el que se guarda son exactamente el mismo. Sin esto, un "{{ 1 }}"
  // escrito con espacios se contaba distinto en cada sitio.
  const bodyText = normalizarVariables(bodyTextCrudo.trim());
  if (!bodyText) return { error: "El cuerpo del mensaje es obligatorio." };

  // Meta aprueba plantillas que después fallan en cada envío porque el
  // mensaje ya armado se pasa de 1.024 caracteres. Se corta aquí, antes de
  // mandarla a aprobación, en vez de descubrirlo destinatario por
  // destinatario.
  if (noSePuedeUsar(bodyText)) return { error: motivoDelExceso(bodyText) };

  // WhatsApp exige numeración desde {{1}} y sin huecos. Mejor decirlo aquí
  // que dejar que Meta lo rechace con un mensaje incomprensible.
  const saltadas = variablesSaltadas(bodyText);
  if (saltadas.length > 0) {
    const lista = saltadas.map((n) => `{{${n}}}`).join(", ");
    return {
      error: `Las variables tienen que empezar en {{1}} y seguir en orden. Te falta ${lista} en el mensaje.`,
    };
  }

  let variables: VariableDePlantilla[] = [];
  try {
    const parseadas = JSON.parse(variablesJson) as VariableDePlantilla[];
    if (Array.isArray(parseadas)) variables = parseadas;
  } catch {
    return { error: "No se entendieron las variables de la plantilla." };
  }

  // Cada variable del texto necesita saber de dónde sale. Sin esto, al enviar
  // se rellenaría solo la primera y Meta rechazaría el mensaje entero.
  const variableCount = cuantasVariables(bodyText);
  if (variableCount > 0 && variables.length !== variableCount) {
    return { error: `La plantilla tiene ${variableCount} variable(s): indica con qué se rellena cada una.` };
  }

  return {
    bodyText,
    variableCount,
    variables: variables.slice(0, variableCount),
    ejemplos: variables.slice(0, variableCount).map((v) => v.ejemplo ?? ""),
  };
}
