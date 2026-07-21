import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId, getWorkspaceRole } from "@/lib/workspace";
import { requireModule } from "@/lib/entitlements";
import { getPhoneNumberStatus } from "@/lib/whatsapp/graph";
import { WhatsAppApiPanel } from "@/components/whatsapp-api-panel";

export default async function SettingsWhatsAppPage() {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  await requireModule(supabase, workspaceId, "settings");

  const role = await getWorkspaceRole(supabase, workspaceId);
  if (role !== "owner" && role !== "admin") {
    redirect("/dashboard");
  }

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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">WhatsApp API</h1>
        <p className="mt-1 text-sm text-muted">
          Conecta y gestiona tu cuenta de WhatsApp Business Cloud API.
        </p>
      </div>

      <WhatsAppApiPanel
        account={whatsappAccount ? { ...whatsappAccount } : null}
        phoneStatus={phoneStatus}
      />
    </div>
  );
}
