import { createAdminClient } from "@/lib/supabase/admin";
import { LIMITE_POR_DEFECTO } from "@/lib/api-publica/autenticar";
import type { LlaveFila, UsoApi } from "@/components/api/api-panel";
import type { WebhookFila, EnvioFila } from "@/components/api/webhooks-panel";

/**
 * Lo que muestra Configuracion -> API: llaves, uso de las ultimas 24 horas,
 * webhooks y sus ultimos avisos. Las tablas no se leen desde el navegador, asi
 * que se consultan aqui, con el servidor (el que llama ya comprobo el rol).
 */
export async function cargarPanelApi(workspaceId: string): Promise<{
  llaves: LlaveFila[];
  uso: UsoApi;
  webhooks: WebhookFila[];
  envios: EnvioFila[];
}> {
  const admin = createAdminClient();
  const hace24h = new Date(Date.now() - 86_400_000).toISOString();
  const [{ data: llaves }, { count: llamadas }, { count: errores }, { data: ajuste }, { data: hooks }, { data: envios }] = await Promise.all([
    admin
      .from("api_llaves")
      .select("id, nombre, prefijo, permisos, vence_el, revocada_el, ultimo_uso_el, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
    admin.from("api_uso").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).gte("created_at", hace24h),
    admin.from("api_uso").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).gte("created_at", hace24h).gte("estado", 400),
    admin.from("api_ajustes").select("limite_por_minuto").eq("workspace_id", workspaceId).maybeSingle(),
    admin
      .from("api_webhooks")
      .select("id, nombre, url, eventos, activo, desactivado_motivo, ultimo_envio_el")
      .eq("workspace_id", workspaceId)
      .order("created_at"),
    admin
      .from("api_webhook_envios")
      .select("id, webhook_id, evento, estado, intentos, ultimo_codigo, ultimo_error, creado_el")
      .eq("workspace_id", workspaceId)
      .order("creado_el", { ascending: false })
      .limit(25),
  ]);
  return {
    llaves: (llaves ?? []) as LlaveFila[],
    uso: { llamadas24h: llamadas ?? 0, errores24h: errores ?? 0, limitePorMinuto: (ajuste?.limite_por_minuto as number | undefined) ?? LIMITE_POR_DEFECTO },
    webhooks: (hooks ?? []) as WebhookFila[],
    envios: (envios ?? []) as EnvioFila[],
  };
}
