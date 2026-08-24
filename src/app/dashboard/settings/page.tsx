import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId, getWorkspaceRole } from "@/lib/workspace";
import { requireModule, getEnabledModuleKeys } from "@/lib/entitlements";
import { listWorkspaceAgents } from "@/lib/agents";
import { getPhoneNumberStatus } from "@/lib/whatsapp/graph";
import { AgentProfileForm } from "@/components/agent-profile-form";
import { AgentsList } from "@/components/agents-list";
import { SettingsTabs } from "@/components/settings-tabs";
import { WhatsAppApiPanel } from "@/components/whatsapp-api-panel";
import { AiAgentPanel } from "@/components/ai-agent-panel";
import { CtwaDatasetForm } from "@/components/ctwa-dataset-form";

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

  const { data: workspacePlan } = workspaceId
    ? await supabase.from("workspaces").select("plan_id").eq("id", workspaceId).maybeSingle()
    : { data: null };
  const { data: plan } = workspacePlan?.plan_id
    ? await supabase.from("plans").select("max_agents").eq("id", workspacePlan.plan_id).maybeSingle()
    : { data: null };
  // null = unlimited (Semestral), 0 = not included in this plan (Inicial), 3 = Pro.
  const maxAgents = plan?.max_agents ?? null;

  const { data: whatsappAccount } = workspaceId
    ? await supabase
        .from("whatsapp_accounts")
        .select("waba_id, phone_number_id, access_token, display_phone_number, status, ctwa_dataset_id")
        .eq("workspace_id", workspaceId)
        .maybeSingle()
    : { data: null };

  let phoneStatus: Awaited<ReturnType<typeof getPhoneNumberStatus>> | null = null;
  if (whatsappAccount) {
    try {
      phoneStatus = await getPhoneNumberStatus(
        whatsappAccount.phone_number_id,
        whatsappAccount.access_token
      );
    } catch {
      phoneStatus = null;
    }
  }

  const agentsSection = (
    <div className="rounded-xl border border-border bg-surface p-5">
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
      <WhatsAppApiPanel
        account={whatsappAccount ? { ...whatsappAccount } : null}
        phoneStatus={phoneStatus}
      />
      {whatsappAccount && (
        <CtwaDatasetForm datasetId={whatsappAccount.ctwa_dataset_id ?? ""} />
      )}
    </div>
  );

  let aiAgentSection: React.ReactNode = undefined;
  if (hasAiAgentModule) {
    const { data: aiAgent } = workspaceId
      ? await supabase
          .from("ai_agents")
          .select(
            "provider, model, agent_name, persona, is_active, followup_enabled, followup_delay_minutes, followup_max_attempts, followup_template_id"
          )
          .eq("workspace_id", workspaceId)
          .maybeSingle()
      : { data: null };

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
          .select("id, meta_template_name, language")
          .eq("workspace_id", workspaceId)
          .eq("status", "APPROVED")
          .order("meta_template_name")
      : { data: [] };

    aiAgentSection = (
      <AiAgentPanel agent={aiAgent} mediaItems={aiAgentMedia ?? []} templates={followupTemplates ?? []} />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Configuración</h1>
        <p className="mt-1 text-sm text-muted">
          Gestiona los agentes de respuesta y tu conexión con WhatsApp API.
        </p>
      </div>

      <SettingsTabs
        agentsContent={agentsSection}
        whatsappContent={whatsappSection}
        aiAgentContent={aiAgentSection}
      />
    </div>
  );
}
