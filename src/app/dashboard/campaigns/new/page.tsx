import { createClient } from "@/lib/supabase/server";
import { NewCampaignForm } from "@/components/campaigns/new-campaign-form";
import { getWorkspaceId } from "@/lib/workspace";
import { requireModule } from "@/lib/entitlements";
import { noSePuedeUsar } from "@/lib/whatsapp/limite-plantilla";

export default async function NewCampaignPage() {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  await requireModule(supabase, workspaceId, "campaigns");

  const { data: templates } = await supabase
    .from("templates")
    .select("id, meta_template_name, status, waba_id, body_text")
    .eq("workspace_id", workspaceId ?? "")
    .eq("status", "APPROVED")
    .eq("created_via", "crm")
    .order("meta_template_name");

  // Fuera de la lista las plantillas cuyo cuerpo se pasa del limite de
  // WhatsApp al reemplazar las variables: siguen aprobadas en Meta, pero todo
  // envio con ellas falla (error 132005), asi que no se ofrecen.
  const plantillasUsables = (templates ?? []).filter((t) => !noSePuedeUsar(t.body_text));

  const { data: tags } = await supabase
    .from("tags")
    .select("id, name, excludes_followups")
    .eq("workspace_id", workspaceId ?? "")
    .order("name");

  const { data: whatsappAccounts } = await supabase
    .from("whatsapp_accounts")
    .select("id, label, display_phone_number, waba_id")
    .eq("workspace_id", workspaceId ?? "")
    .neq("status", "frozen")
    .order("connected_at");

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-[13px] border border-border bg-surface p-6">
        <h1 className="mb-4 font-dash-display text-[22px] font-bold tracking-[-.4px] text-foreground">Nueva campaña</h1>
        <NewCampaignForm
          templates={plantillasUsables}
          tags={tags ?? []}
          whatsappAccounts={whatsappAccounts ?? []}
        />
      </div>
    </div>
  );
}
