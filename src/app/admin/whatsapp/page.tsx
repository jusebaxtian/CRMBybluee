import { createAdminClient } from "@/lib/supabase/admin";
import { ConnectPlatformWhatsAppButton } from "@/components/admin/connect-platform-whatsapp-button";
import { DisconnectPlatformWhatsAppButton } from "@/components/admin/disconnect-platform-whatsapp-button";
import { ActivationTemplateConfigPanel } from "@/components/admin/activation-template-config";
import { getActivationTemplateConfig } from "@/app/actions/admin-whatsapp";
import { obtenerAjusteRecuperacion } from "@/app/actions/recuperacion";
import { RecuperacionConfigPanel } from "@/components/admin/recuperacion-config";
import { isPlatformAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";

export default async function AdminWhatsAppPage() {
  const admin = createAdminClient();

  const { data: account } = await admin
    .from("platform_whatsapp_account")
    .select("display_phone_number, status, connected_at")
    .maybeSingle();

  const { data: templates } = await admin
    .from("platform_templates")
    .select("meta_template_name, language, status, body_text, variable_count")
    .order("meta_template_name");

  const activationConfig = await getActivationTemplateConfig();

  // Los codigos de recuperacion salen por una linea del espacio del propio
  // administrador (soporte), no por el WhatsApp de administracion: ese apunta
  // a ventas, que carga los masivos.
  const supabase = await createClient();
  const esAdmin = await isPlatformAdmin(supabase);
  const workspaceId = esAdmin ? await getWorkspaceId(supabase) : null;

  const { data: lineasPropias } = workspaceId
    ? await admin
        .from("whatsapp_accounts")
        .select("id, label, display_phone_number, waba_id, status")
        .eq("workspace_id", workspaceId)
        .neq("status", "frozen")
        .order("connected_at")
    : { data: null };

  const ajusteRecuperacion = await obtenerAjusteRecuperacion();

  // Plantillas de autenticacion de la WABA de la linea elegida: son las unicas
  // que sirven para mandar un codigo.
  const lineaElegida = (lineasPropias ?? []).find((l) => l.id === ajusteRecuperacion?.whatsappAccountId);
  const { data: plantillasAuth } = workspaceId
    ? await admin
        .from("templates")
        .select("meta_template_name, language, status, waba_id")
        .eq("workspace_id", workspaceId)
        .eq("category", "AUTHENTICATION")
        .neq("status", "DELETED")
        .order("meta_template_name")
    : { data: null };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">WhatsApp de administración</h1>
        <p className="mt-1 text-sm text-muted">
          Número independiente del CRM de tus clientes, usado solo para enviarles notificaciones
          por plantilla (ej. activación de plan) desde acciones del panel admin.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <p className="mb-3 text-sm font-medium text-foreground">Conexión</p>
        {account ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">{account.display_phone_number}</p>
              <p className="text-xs text-success">Conectado</p>
            </div>
            <DisconnectPlatformWhatsAppButton />
          </div>
        ) : (
          <div>
            <p className="mb-3 text-sm text-muted">No hay ningún número conectado todavía.</p>
            <ConnectPlatformWhatsAppButton />
          </div>
        )}
      </div>

      {account && (
        <ActivationTemplateConfigPanel
          templates={templates ?? []}
          initialConfig={activationConfig}
        />
      )}

      {esAdmin && (
        <RecuperacionConfigPanel
          lineas={(lineasPropias ?? []).map((l) => ({
            id: l.id,
            etiqueta: l.label ? `${l.display_phone_number} · ${l.label}` : l.display_phone_number,
          }))}
          plantillas={(plantillasAuth ?? []).filter(
            (p) => !lineaElegida?.waba_id || !p.waba_id || p.waba_id === lineaElegida.waba_id
          )}
          ajusteInicial={ajusteRecuperacion}
        />
      )}
    </div>
  );
}
