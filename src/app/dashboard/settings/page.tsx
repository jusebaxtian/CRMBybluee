import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId, getWorkspaceRole } from "@/lib/workspace";
import { requireModule } from "@/lib/entitlements";
import { listWorkspaceAgents } from "@/lib/agents";
import { AgentProfileForm } from "@/components/agent-profile-form";
import { AgentsList } from "@/components/agents-list";

export default async function SettingsPage() {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  await requireModule(supabase, workspaceId, "settings");

  const role = await getWorkspaceRole(supabase, workspaceId);
  if (role !== "owner" && role !== "admin") {
    redirect("/dashboard");
  }

  const agents = await listWorkspaceAgents(supabase, workspaceId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Agentes de respuesta</h1>
        <p className="mt-1 text-sm text-muted">
          Crea perfiles de agentes de respuesta. Cada agente solo puede ver y responder las
          conversaciones que se le asignen — manualmente, por transferencia, o desde una
          automatización.
        </p>
      </div>

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
    </div>
  );
}
