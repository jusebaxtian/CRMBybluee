import { createAdminClient } from "@/lib/supabase/admin";
import { ConnectPlatformWhatsAppButton } from "@/components/connect-platform-whatsapp-button";
import { DisconnectPlatformWhatsAppButton } from "@/components/disconnect-platform-whatsapp-button";
import { ActivationTemplateConfigPanel } from "@/components/activation-template-config";
import { getActivationTemplateConfig } from "@/app/actions/admin-whatsapp";

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
    </div>
  );
}
