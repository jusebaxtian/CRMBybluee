import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId, getWorkspaceRole } from "@/lib/workspace";
import { requireModule, getEnabledModuleKeys } from "@/lib/entitlements";
import { listWorkspaceAgents } from "@/lib/agents";
import { getPhoneNumberStatus, getWabaStatus, tramoEfectivo } from "@/lib/whatsapp/graph";
import { AgentProfileForm } from "@/components/account/agent-profile-form";
import { AgentsList } from "@/components/account/agents-list";
import { SettingsTabs } from "@/components/layout/settings-tabs";
import { IntegracionesPanel, type ConexionGoogle } from "@/components/integraciones/integraciones-panel";
import { ApiPanel } from "@/components/api/api-panel";
import { DocumentacionApi } from "@/components/api/documentacion-api";
import { WebhooksPanel } from "@/components/api/webhooks-panel";
import { MODULO_API } from "@/lib/api-publica/permisos";
import { LIMITE_POR_DEFECTO } from "@/lib/api-publica/autenticar";
import { cargarPanelApi } from "@/lib/api-publica/panel";
import { WhatsAppApiPanel } from "@/components/whatsapp/whatsapp-api-panel";
import { AgentesPorLinea, type AgenteFila } from "@/components/ai-agent/agentes-por-linea";
import { CtwaDatasetForm } from "@/components/whatsapp/ctwa-dataset-form";
import { limiteDeNumeros } from "@/lib/whatsapp/limite-numeros";
import { limiteDeAgentes } from "@/lib/agentes/limite-agentes";
import { noSePuedeUsar } from "@/lib/whatsapp/limite-plantilla";

export default async function SettingsPage() {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  await requireModule(supabase, workspaceId, "settings");
  const enabledModules = await getEnabledModuleKeys(supabase, workspaceId);
  const hasAiAgentModule = enabledModules.includes("ai_agent");

  const role = await getWorkspaceRole(supabase, workspaceId);
  if (role !== "owner" && role !== "admin") {
    redirect("/dashboard");
  }

  const agents = await listWorkspaceAgents(supabase, workspaceId);

  // Plan + cupo extra concedido desde admin; null = ilimitado, 0 = sin agentes.
  const maxAgents = workspaceId ? (await limiteDeAgentes(supabase, workspaceId)).total : null;
  // Plan + cupo extra concedido desde admin. El helper es el mismo que usa la
  // accion de conectar, asi que la pantalla y la comprobacion no pueden
  // discrepar.
  const limiteNumeros = workspaceId
    ? await limiteDeNumeros(supabase, workspaceId)
    : { plan: 1, extra: 0, total: 1 };
  const maxWhatsappNumbers = limiteNumeros.total;

  const { data: whatsappAccounts } = workspaceId
    ? await supabase
        .from("whatsapp_accounts")
        .select("id, waba_id, phone_number_id, access_token, display_phone_number, status, label, ctwa_dataset_id")
        .eq("workspace_id", workspaceId)
        .order("connected_at")
    : { data: [] };

  const accounts = whatsappAccounts ?? [];

  const phoneStatuses: Record<string, Awaited<ReturnType<typeof getPhoneNumberStatus>> | null> = {};
  await Promise.all(
    accounts
      .filter((a) => a.status !== "frozen")
      .map(async (a) => {
        try {
          const [estado, waba] = await Promise.all([
            getPhoneNumberStatus(a.phone_number_id, a.access_token),
            a.waba_id ? getWabaStatus(a.waba_id, a.access_token).catch(() => null) : Promise.resolve(null),
          ]);
          const tramo = tramoEfectivo(estado.messaging_limit_tier, waba?.whatsapp_business_manager_messaging_limit);
          phoneStatuses[a.id] = tramo ? { ...estado, messaging_limit_tier: tramo } : estado;
        } catch {
          phoneStatuses[a.id] = null;
        }
      })
  );

  const agentsSection = (
    <div className="rounded-[13px] border border-border bg-surface p-5">
      <div className="mb-4 flex items-center gap-2">
        <Users size={18} className="text-primary" />
        <h2 className="text-base font-semibold text-foreground">
          Agentes de respuesta {maxAgents !== null ? `(${agents.length}/${maxAgents})` : `(${agents.length})`}
        </h2>
      </div>

      {maxAgents === 0 ? (
        <p className="text-sm text-muted">
          Tu plan actual no incluye agentes de respuesta. Mejora tu plan para agregar hasta 3, o
          agentes ilimitados con el plan Semestral.
        </p>
      ) : (
        <>
          <AgentsList agents={agents} />

          {(maxAgents === null || agents.length < maxAgents) && (
            <div className="mt-5 border-t border-border pt-5">
              <AgentProfileForm />
            </div>
          )}
        </>
      )}
    </div>
  );

  const whatsappSection = (
    <div className="flex flex-col gap-5">
      <WhatsAppApiPanel accounts={accounts} phoneStatuses={phoneStatuses} maxNumbers={maxWhatsappNumbers} />
      {accounts
        .filter((a) => a.status !== "frozen")
        .map((a) => (
          <CtwaDatasetForm key={a.id} accountId={a.id} datasetId={a.ctwa_dataset_id ?? ""} />
        ))}
    </div>
  );

  let aiAgentSection: React.ReactNode = undefined;
  if (hasAiAgentModule) {
    // Un agente por linea (migracion 0118).
    const { data: aiAgents } = workspaceId
      ? await supabase
          .from("ai_agents")
          .select(
            "whatsapp_account_id, provider, model, agent_name, persona, is_active, followup_enabled, followup_steps, followup_template_id"
          )
          .eq("workspace_id", workspaceId)
      : { data: [] };

    const { data: aiAgentMedia } = workspaceId
      ? await supabase
          .from("ai_agent_media")
          .select("id, key, label, trigger_description, media_type, media_url")
          .eq("workspace_id", workspaceId)
          .order("created_at")
      : { data: [] };

    const { data: followupTemplates } = workspaceId
      ? await supabase
          .from("templates")
          .select("id, meta_template_name, language, body_text, header_format, header_text, header_media_url, buttons, variables_origen")
          .eq("workspace_id", workspaceId)
          .eq("status", "APPROVED")
          .eq("created_via", "crm")
          .order("meta_template_name")
      : { data: [] };

    aiAgentSection = (
      <AgentesPorLinea
        agentes={(aiAgents ?? []) as AgenteFila[]}
        lineas={(accounts ?? []).filter((a) => a.status !== "frozen")}
        mediaItems={aiAgentMedia ?? []}
        templates={(followupTemplates ?? []).filter((t) => !noSePuedeUsar(t.body_text))}
      />
    );
  }

  // Integraciones: la conexion es PERSONAL (cada usuario su Google), asi que se lee la del usuario actual.
  const { data: { user: usuarioActual } } = await supabase.auth.getUser();
  const { data: conexionGoogle } = usuarioActual
    ? await supabase
        .from("integraciones_conexiones")
        .select("cuenta_email, estado")
        .eq("user_id", usuarioActual.id)
        .eq("proveedor", "google_calendar")
        .maybeSingle()
    : { data: null };
  const { data: ajustesAgenda } = workspaceId
    ? await supabase.from("agenda_ajustes").select("whatsapp_account_id").eq("workspace_id", workspaceId).maybeSingle()
    : { data: null };
  const integrationsSection = (
    <IntegracionesPanel
      moduloIncluido={enabledModules.includes("google_calendar")}
      google={(conexionGoogle as ConexionGoogle) ?? null}
      lineas={accounts
        .filter((a) => a.status !== "frozen")
        .map((a) => ({ id: a.id, nombre: a.label ? `${a.label} · ${a.display_phone_number}` : a.display_phone_number }))}
      lineaDeCitas={(ajustesAgenda?.whatsapp_account_id as string | null | undefined) ?? null}
    />
  );

  // API e integraciones: solo se consulta si el plan incluye el modulo.
  const moduloApi = enabledModules.includes(MODULO_API);
  const datosApi = moduloApi && workspaceId ? await cargarPanelApi(workspaceId) : null;
  const apiSection = (
    <ApiPanel
      moduloIncluido={moduloApi}
      llaves={datosApi?.llaves ?? []}
      uso={datosApi?.uso ?? { llamadas24h: 0, errores24h: 0, limitePorMinuto: LIMITE_POR_DEFECTO }}
      webhooks={<WebhooksPanel webhooks={datosApi?.webhooks ?? []} envios={datosApi?.envios ?? []} />} documentacion={<DocumentacionApi />} />
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-dash-display text-[22px] font-bold tracking-[-.4px] text-foreground">Configuración</h1>
        <p className="mt-1 text-sm text-muted">
          Gestiona los agentes de respuesta y tu conexión con WhatsApp API.
        </p>
      </div>

      <SettingsTabs
        agentsContent={agentsSection}
        whatsappContent={whatsappSection}
        aiAgentContent={aiAgentSection}
        integrationsContent={integrationsSection}
        apiContent={apiSection}
      />
    </div>
  );
}
