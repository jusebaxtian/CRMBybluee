import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAdminAccess, startImpersonation } from "@/app/actions/admin";
import { WorkspaceAdminEditor } from "@/components/workspace-admin-editor";
import { EditClientFields } from "@/components/edit-client-fields";

export default async function AdminWorkspaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, status, plan_id, trial_ends_at, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!workspace) notFound();

  await logAdminAccess(id);

  const { data: plans } = await supabase.from("plans").select("id, name").order("name");

  const [{ count: contactsCount }, { count: conversationsCount }, { count: membersCount }] =
    await Promise.all([
      supabase.from("contacts").select("id", { count: "exact", head: true }).eq("workspace_id", id),
      supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", id),
      supabase
        .from("workspace_members")
        .select("user_id", { count: "exact", head: true })
        .eq("workspace_id", id),
    ]);

  const { data: whatsappAccount } = await supabase
    .from("whatsapp_accounts")
    .select("display_phone_number, status")
    .eq("workspace_id", id)
    .maybeSingle();

  const { data: recentAccess } = await supabase
    .from("admin_access_logs")
    .select("accessed_at")
    .eq("workspace_id", id)
    .order("accessed_at", { ascending: false })
    .limit(5);

  const { data: owner } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", id)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();

  let ownerEmail: string | null = null;
  if (owner?.user_id) {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.getUserById(owner.user_id);
    ownerEmail = data.user?.email ?? null;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link href="/admin" className="text-muted hover:text-foreground">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="flex-1 text-2xl font-semibold text-foreground">{workspace.name}</h1>
        <form action={startImpersonation.bind(null, workspace.id)}>
          <button
            type="submit"
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
          >
            <LogIn size={14} />
            Entrar como este cliente
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <p className="mb-4 text-sm font-medium text-foreground">Datos del cliente</p>
        <EditClientFields
          workspaceId={workspace.id}
          workspaceName={workspace.name}
          ownerId={owner?.user_id ?? null}
          ownerEmail={ownerEmail}
        />
      </div>

      <WorkspaceAdminEditor
        workspaceId={workspace.id}
        currentPlanId={workspace.plan_id}
        currentStatus={workspace.status}
        plans={plans ?? []}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard label="Contactos" value={contactsCount ?? 0} />
        <StatCard label="Conversaciones" value={conversationsCount ?? 0} />
        <StatCard label="Usuarios" value={membersCount ?? 0} />
        <StatCard
          label="WhatsApp"
          value={whatsappAccount ? whatsappAccount.display_phone_number ?? "Conectado" : "No conectado"}
        />
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <p className="mb-3 text-sm font-medium text-foreground">
          Registro de accesos de soporte (últimos 5)
        </p>
        {recentAccess && recentAccess.length > 0 ? (
          <ul className="flex flex-col gap-1 text-xs text-muted">
            {recentAccess.map((a, i) => (
              <li key={i}>{new Date(a.accessed_at).toLocaleString("es-CO")}</li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted">Sin accesos registrados aún.</p>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}
