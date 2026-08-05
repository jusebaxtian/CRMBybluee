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

  const { data: whatsappAccount } = workspaceId
    ? await supabase
        .from("whatsapp_accounts")
        .select("waba_id, phone_number_id, access_token, display_phone_number, status")
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
          Agentes de respuesta ({agents.length}/3)
        </h2>
      </div>

      <AgentsList agents={agents} />

      {agents.length < 3 && (
        <div className="mt-5 border-t border-border pt-5">
          <AgentProfileForm />
        </div>
      )}
    </div>
  );

  const whatsappSection = (
    <WhatsAppApiPanel
      account={whatsappAccount ? { ...whatsappAccount } : null}
      phoneStatus={phoneStatus}
    />
  );

  let aiAgentSection: React.ReactNode = undefined;
  if (hasAiAgentModule) {
    const { data: aiAgent } = workspaceId
      ? await supabase
          .from("ai_agents")
          .select("provider, model, agent_name, persona, is_active")
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

    aiAgentSection = <AiAgentPanel agent={aiAgent} mediaItems={aiAgentMedia ?? []} />;
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
