import Link from "next/link";
import { Reply, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { QuickReplyRowActions } from "@/components/quick-reply-row-actions";
import { getWorkspaceId } from "@/lib/workspace";
import { requireModule } from "@/lib/entitlements";

export default async function QuickRepliesPage() {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  await requireModule(supabase, workspaceId, "quick_replies");

  const { data: quickReplies } = await supabase
    .from("quick_replies")
    .select("id, name, is_active, quick_reply_actions(action_type)")
    .eq("workspace_id", workspaceId ?? "")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Respuestas rápidas</h1>
          <p className="mt-1 text-sm text-muted">
            Flujos que envías con un clic desde una conversación en el chat.
          </p>
        </div>
        <Link
          href="/dashboard/quick-replies/new"
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
        >
          <Plus size={16} />
          Nueva respuesta rápida
        </Link>
      </div>

      {!quickReplies || quickReplies.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface p-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-hover text-muted">
            <Reply size={22} />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            Todavía no tienes respuestas rápidas
          </h2>
          <p className="mt-1 max-w-md text-sm text-muted">
            Crea flujos (texto, imágenes, plantillas...) que aparecerán como opciones flotantes en
            el chat para enviarlos con un solo clic.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          {quickReplies.map((qr) => (
            <div
              key={qr.id}
              className="flex items-center justify-between border-b border-border px-5 py-4 last:border-b-0"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{qr.name}</p>
                <p className="text-xs text-muted">
                  {qr.quick_reply_actions.length} acción(es)
                </p>
              </div>
              <QuickReplyRowActions
                quickReplyId={qr.id}
                quickReplyName={qr.name}
                isActive={qr.is_active}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
