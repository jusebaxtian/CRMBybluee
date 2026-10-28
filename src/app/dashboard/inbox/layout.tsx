import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { requireModule } from "@/lib/entitlements";
import { ConversationListPanel } from "@/components/inbox/conversation-list-panel";
import { InboxShell } from "@/components/inbox/inbox-shell";
import { RealtimeRefresh } from "@/components/ui/realtime-refresh";
import { listWorkspaceAgents } from "@/lib/agents";
import { loadInboxPage } from "@/lib/inbox/load";
import { cookies } from "next/headers";
import { isPlatformAdmin } from "@/lib/admin";
import { IMPERSONATION_COOKIE } from "@/lib/workspace";
import { cargarCiclos } from "@/lib/inbox/ciclo-de-plan";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { vendedorActivo } from "@/lib/vendedores/ventas";
import { resumirVentas } from "@/lib/vendedores/comision";

export default async function InboxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  await requireModule(supabase, workspaceId, "inbox");

  // Una sola pagina. Antes se pedia sin limite y PostgREST cortaba en 1.000
  // por su cuenta: el espacio de 9.991 conversaciones mostraba 1.000 y nada
  // lo indicaba. El resto de paginas las trae cargarMasConversaciones.
  const { conversations, hayMas } = await loadInboxPage(supabase, workspaceId ?? "");

  // La insignia de no leidos cuenta sobre todo el espacio, no sobre la pagina.
  const { data: sinLeer } = await supabase.rpc("inbox_unread_count", {
    p_workspace_id: workspaceId ?? "",
  });

  const { data: channels } = workspaceId
    ? await supabase
        .from("whatsapp_accounts")
        .select("id, label, display_phone_number")
        .eq("workspace_id", workspaceId)
        .order("connected_at")
    : { data: [] };

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, name, wa_id")
    .eq("workspace_id", workspaceId ?? "")
    .order("name");

  const { data: workspaceTags } = await supabase
    .from("tags")
    .select("id, name, color")
    .eq("workspace_id", workspaceId ?? "")
    .order("name");

  const agents = await listWorkspaceAgents(supabase, workspaceId);

  // Mensual / semestral / anual de cada cliente, solo en el espacio propio del
  // administrador. En "modo soporte" (viendo el espacio de un cliente) no se
  // carga: esos contactos no son clientes del administrador.
  const enModoSoporte = !!(await cookies()).get(IMPERSONATION_COOKIE)?.value;
  const ciclos = !enModoSoporte && (await isPlatformAdmin(supabase)) ? await cargarCiclos(supabase) : {};

  // Vendedor (migracion 0158): banda arriba de sus chats con lo que ha vendido.
  let bandaVendedor: React.ReactNode = null;
  if (!enModoSoporte) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const admin = createAdminClient();
    if (user && (await vendedorActivo(admin, user.id))) {
      const { data: ventas } = await admin
        .from("ventas_vendedor")
        .select("estado, monto_cents, comision_cents, created_at")
        .eq("vendedor_id", user.id);
      const r = resumirVentas((ventas ?? []) as Parameters<typeof resumirVentas>[0], new Date());
      const pesos = (c: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(c / 100);
      bandaVendedor = (
        <Link
          href="/dashboard/inbox/mis-ventas"
          className="flex items-center justify-between gap-2 border-b border-border bg-primary/10 px-3 py-2 text-xs text-foreground hover:bg-primary/15"
        >
          <span>
            💰 <strong>{r.licenciasTotal}</strong> {r.licenciasTotal === 1 ? "licencia" : "licencias"} · por cobrar{" "}
            <strong>{pesos(r.porCobrarCents)}</strong>
          </span>
          <span className="font-semibold text-primary">Mis ventas →</span>
        </Link>
      );
    }
  }

  const panel = (
    <ConversationListPanel
      conversations={conversations}
      hayMas={hayMas}
      unreadConversationsCount={Number(sinLeer ?? 0)}
      contacts={contacts ?? []}
      allTags={workspaceTags ?? []}
      agents={agents}
      channels={channels ?? []}
      ciclos={ciclos}
    />
  );

  return (
    <div className="-m-4 sm:-m-5">
      {workspaceId && (
        <RealtimeRefresh
          table="conversations"
          filter={`workspace_id=eq.${workspaceId}`}
          channelName={`conversations-${workspaceId}`}
        />
      )}
      <InboxShell
        list={
          bandaVendedor ? (
            // Solo para vendedores: la banda encima de la lista, sin cambiar la bandeja de los demas.
            <div className="flex min-h-0 w-full flex-col lg:w-auto">
              {bandaVendedor}
              <div className="flex min-h-0 flex-1">{panel}</div>
            </div>
          ) : (
            panel
          )
        }
      >
        {children}
      </InboxShell>
    </div>
  );
}
