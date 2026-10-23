import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { huellaDe, llaveDeLaCabecera } from "@/lib/api-publica/llaves";
import { MODULO_API, esPermiso, type Permiso } from "@/lib/api-publica/permisos";
import { consumir } from "@/lib/api-publica/limite";
import { error } from "@/lib/api-publica/respuestas";

export const LIMITE_POR_DEFECTO = 60;

export type ContextoApi = {
  workspaceId: string;
  llaveId: string;
  permisos: Permiso[];
  admin: SupabaseClient;
};

/**
 * Valida la llave de una peticion: que exista, no este revocada ni vencida, que
 * el espacio siga activo y con el modulo, que tenga el permiso pedido y que no
 * se pase del tope por minuto. Devuelve el contexto, o la respuesta de error ya armada.
 */
export async function autenticar(
  request: Request,
  permiso: Permiso | null
): Promise<{ ctx: ContextoApi } | { respuesta: Response }> {
  const llave = llaveDeLaCabecera(request.headers.get("authorization"));
  if (!llave) {
    return { respuesta: error("llave_invalida", "Falta la llave de API. Envíala en la cabecera Authorization: Bearer <tu llave>.") };
  }

  const admin = createAdminClient();
  const { data: fila } = await admin
    .from("api_llaves")
    .select("id, workspace_id, permisos, vence_el, revocada_el, ultimo_uso_el")
    .eq("huella", huellaDe(llave))
    .maybeSingle();
  if (!fila || fila.revocada_el) {
    return { respuesta: error("llave_invalida", "La llave de API no es válida o fue revocada.") };
  }
  if (fila.vence_el && new Date(fila.vence_el).getTime() <= Date.now()) {
    return { respuesta: error("llave_vencida", "La llave de API venció. Crea una nueva en Configuración → API e integraciones.") };
  }

  const workspaceId = fila.workspace_id as string;
  const { data: espacio } = await admin
    .from("workspaces")
    .select("status, access_disabled, plan_id")
    .eq("id", workspaceId)
    .maybeSingle();
  if (!espacio || espacio.access_disabled || espacio.status === "past_due" || espacio.status === "canceled") {
    return { respuesta: error("cuenta_bloqueada", "La cuenta no tiene un plan activo. Renueva tu plan para usar la API.") };
  }
  const { data: modulo } = espacio.plan_id
    ? await admin.from("plan_modules").select("module_key").eq("plan_id", espacio.plan_id).eq("module_key", MODULO_API).maybeSingle()
    : { data: null };
  if (!modulo) {
    return { respuesta: error("modulo_no_incluido", "Tu plan no incluye el módulo de API. Contacta a soporte para activarlo.") };
  }

  const permisos = ((fila.permisos as string[]) ?? []).filter(esPermiso);
  if (permiso && !permisos.includes(permiso)) {
    return { respuesta: error("permiso_denegado", `Esta llave no tiene el permiso «${permiso}».`, { permiso_requerido: permiso }) };
  }

  const { data: ajuste } = await admin.from("api_ajustes").select("limite_por_minuto").eq("workspace_id", workspaceId).maybeSingle();
  const tope = (ajuste?.limite_por_minuto as number | undefined) ?? LIMITE_POR_DEFECTO;
  // El tope es del espacio entero, no de cada llave: varias llaves no lo multiplican.
  const limite = consumir(`espacio:${workspaceId}`, tope);
  if (!limite.permitido) {
    return {
      respuesta: error(
        "limite_excedido",
        `Superaste el límite de ${tope} peticiones por minuto. Reintenta en ${limite.reintentarEnSeg} s.`,
        { reintentar_en_segundos: limite.reintentarEnSeg },
        { "Retry-After": String(limite.reintentarEnSeg) }
      ),
    };
  }

  // Una vez por minuto basta para saber cuando se uso por ultima vez.
  if (!fila.ultimo_uso_el || Date.now() - new Date(fila.ultimo_uso_el).getTime() > 60_000) {
    void admin.from("api_llaves").update({ ultimo_uso_el: new Date().toISOString() }).eq("id", fila.id).then(() => {}, () => {});
  }

  return { ctx: { workspaceId, llaveId: fila.id as string, permisos, admin } };
}

/**
 * Envoltorio de cada ruta: autentica, ejecuta, atrapa errores inesperados y deja
 * el registro de la llamada (metodo, ruta, estado, milisegundos; sin cuerpos).
 */
export async function conApi(
  request: Request,
  permiso: Permiso | null,
  manejador: (ctx: ContextoApi) => Promise<Response>
): Promise<Response> {
  const inicio = Date.now();
  const auth = await autenticar(request, permiso);
  if ("respuesta" in auth) return auth.respuesta;
  const { ctx } = auth;

  let respuesta: Response;
  try {
    respuesta = await manejador(ctx);
  } catch (err) {
    console.error("api publica:", err instanceof Error ? err.message : err);
    respuesta = error("error_interno", "Ocurrió un error inesperado. Intenta de nuevo; si persiste, contacta a soporte.");
  }

  void ctx.admin
    .from("api_uso")
    .insert({
      workspace_id: ctx.workspaceId,
      llave_id: ctx.llaveId,
      metodo: request.method,
      ruta: new URL(request.url).pathname,
      estado: respuesta.status,
      ms: Date.now() - inicio,
    })
    .then(() => {}, () => {});
  return respuesta;
}
