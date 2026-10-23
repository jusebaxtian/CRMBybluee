import type { SupabaseClient } from "@supabase/supabase-js";
import definicion from "@/lib/agenda/plantillas-cita.json";
import { ErrorDeMeta, createMetaTemplate } from "@/lib/whatsapp/graph";
import { wabasDelEspacio } from "@/lib/whatsapp/wabas";
import { textoDeFecha } from "@/lib/agenda/tiempo";

/**
 * Las plantillas con las que el CRM confirma una cita por WhatsApp cuando la
 * ventana de 24 horas del contacto esta cerrada: una con el boton "Ir a la
 * reunion" (link de Meet) y otra sin el, para las citas sin reunion.
 *
 * Meta es duena de las plantillas por WABA, asi que cada cliente necesita las
 * suyas. Se crean solas cuando conecta su Google Calendar y el texto lleva el
 * nombre de SU empresa como variable: el CRM no se anuncia a si mismo.
 */

export const IDIOMA_CITA = definicion.language;
export const PLANTILLAS_CITA = definicion.plantillas;

export function plantillaDeCita(conMeet: boolean) {
  return PLANTILLAS_CITA.find((p) => p.conMeet === conMeet)!;
}

/**
 * Todos los nombres con los que puede existir una plantilla de cita: el original y
 * los de reemplazo, en orden de preferencia.
 *
 * Meta no deja volver a crear una plantilla con el mismo nombre e idioma durante
 * cuatro semanas despues de borrarla (error 2388023). Si alguien la borra, se crea
 * una con nombre de reemplazo y el envio usa la que este aprobada.
 */
export function nombresDePlantilla(p: { name: string; alternativas?: readonly string[] }): string[] {
  return [p.name, ...(p.alternativas ?? [])];
}

/** De las filas guardadas, la que se debe usar: la primera APROBADA (en orden de preferencia) o, si no hay, la primera que exista. */
export function elegirPlantillaGuardada<T extends { meta_template_name: string; status: string }>(
  filas: T[],
  p: { name: string; alternativas?: readonly string[] }
): T | null {
  const orden = nombresDePlantilla(p);
  const ordenadas = orden.flatMap((n) => filas.filter((f) => f.meta_template_name === n));
  return ordenadas.find((f) => f.status === "APPROVED") ?? ordenadas[0] ?? null;
}

/** Meta rechaza el nombre porque se borro hace poco (ver `nombresDePlantilla`). */
export function nombreBloqueadoPorBorrado(err: unknown): boolean {
  if (err instanceof ErrorDeMeta && err.subcodigo === 2388023) return true;
  return err instanceof Error && /eliminando|being deleted|2388023/i.test(err.message);
}

/** WhatsApp no admite saltos de linea, tabuladores ni mas de cuatro espacios seguidos en un parametro. */
export function limpiarParametro(valor: string, max = 200): string {
  return valor.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim().slice(0, max) || "-";
}

/** Los cuatro valores del cuerpo, en orden: contacto, empresa, titulo y fecha. */
export function parametrosDeCita(d: { contacto: string | null; empresa: string; titulo: string; inicioIso: string }): string[] {
  return [
    d.contacto?.trim() ? limpiarParametro(d.contacto, 60) : "cliente",
    limpiarParametro(d.empresa, 60),
    limpiarParametro(d.titulo, 100),
    limpiarParametro(textoDeFecha(d.inicioIso), 80),
  ];
}

/** El codigo del link de Meet ("abc-defg-hij"), que es lo que llena el boton. */
export function codigoDeMeet(url: string | null | undefined): string | null {
  const m = /^https:\/\/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})(?:[/?].*)?$/.exec(url ?? "");
  return m ? m[1] : null;
}

/**
 * Crea (si faltan) las plantillas de cita en cada WABA del espacio. Se puede
 * llamar las veces que sea: lo que ya existe no se toca. Nunca lanza: un fallo
 * de Meta aqui no debe tumbar la conexion con Google; se reintenta desde el
 * formulario de la cita.
 */
export async function asegurarPlantillasDeCita(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<{ creadas: number; existentes: number; fallos: string[] }> {
  const resultado = { creadas: 0, existentes: 0, fallos: [] as string[] };
  const wabas = await wabasDelEspacio(supabase, workspaceId);

  for (const waba of wabas) {
    const { data: ya } = await supabase
      .from("templates")
      .select("meta_template_name")
      .eq("workspace_id", workspaceId)
      .eq("waba_id", waba.wabaId)
      .eq("language", IDIOMA_CITA)
      .in("meta_template_name", PLANTILLAS_CITA.flatMap(nombresDePlantilla));
    const existentes = new Set((ya ?? []).map((t) => t.meta_template_name as string));

    for (const p of PLANTILLAS_CITA) {
      const nombres = nombresDePlantilla(p);
      if (nombres.some((n) => existentes.has(n))) {
        resultado.existentes += 1;
        continue;
      }
      // Se prueba el nombre original y, si Meta lo tiene bloqueado por un borrado reciente, los de reemplazo.
      for (const nombre of nombres) {
        try {
          const creada = await createMetaTemplate(waba.wabaId, waba.accessToken, {
            name: nombre,
            language: IDIOMA_CITA,
            category: definicion.category as "UTILITY",
            bodyText: p.body,
            ejemplos: p.ejemplos,
            buttons: p.boton ? [{ type: "URL", text: p.boton.text, url: p.boton.url }] : undefined,
          });
          const { error } = await supabase.from("templates").upsert(
            {
              workspace_id: workspaceId,
              waba_id: waba.wabaId,
              meta_template_name: nombre,
              language: IDIOMA_CITA,
              category: definicion.category,
              status: creada.status,
              body_text: p.body,
              buttons: p.boton ? [{ type: "URL", text: p.boton.text, url: p.boton.url }] : null,
              variable_count: p.ejemplos.length,
              variables_origen: null,
              synced_at: new Date().toISOString(),
              created_via: "crm",
            },
            { onConflict: "workspace_id,waba_id,meta_template_name,language" }
          );
          if (error) resultado.fallos.push(`${nombre}: creada en Meta pero no guardada (${error.message})`);
          else resultado.creadas += 1;
          break;
        } catch (err) {
          const mensaje = err instanceof Error ? err.message : "error desconocido";
          // Borrada hace poco: Meta no deja ese nombre todavia, se prueba el siguiente.
          if (nombreBloqueadoPorBorrado(err) && nombre !== nombres[nombres.length - 1]) continue;
          // Ya existe en Meta pero no aqui: la trae "Sincronizar", no es un fallo.
          if (/already exists|ya existe/i.test(mensaje)) resultado.existentes += 1;
          else resultado.fallos.push(`${nombre}: ${mensaje}`);
          break;
        }
      }
    }
  }
  return resultado;
}
