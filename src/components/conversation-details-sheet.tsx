"use client";

import { useState } from "react";
import { Info, X, Zap, Megaphone } from "lucide-react";
import { ContactTagPicker } from "@/components/contact-tag-picker";
import { NotesEditor } from "@/components/notes-editor";
import { ConversationAssignmentControl } from "@/components/conversation-assignment-control";
import { ConversationFollowupsToggle } from "@/components/conversation-followups-toggle";
import { ContactBlockedNotice } from "@/components/contact-blocked-notice";
import { AiHandoffNotice } from "@/components/ai-handoff-notice";

type Agent = { id: string; name: string | null; email: string };
type Tag = { id: string; name: string; color: string };
type Automation = { id: string; name: string; is_active: boolean };

export function ConversationDetailsSheet({
  contactName,
  contactWaId,
  conversationId,
  contactId,
  agents,
  assignedAgentId,
  allTags,
  assignedTagIds,
  notes,
  automations,
  likelyBlocked,
  aiHandoffRequested,
  followupsEnabled,
  excludedFromFollowupsByTag,
  adSourceId,
  adHeadline,
  adBody,
}: {
  contactName: string | null;
  contactWaId: string;
  conversationId: string;
  contactId: string;
  agents: Agent[];
  assignedAgentId: string | null;
  allTags: Tag[];
  assignedTagIds: string[];
  notes: string | null;
  automations: Automation[];
  likelyBlocked: boolean;
  aiHandoffRequested: boolean;
  followupsEnabled: boolean;
  excludedFromFollowupsByTag: boolean;
  adSourceId: string | null;
  adHeadline: string | null;
  adBody: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Ver detalles de la conversación"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-hover hover:text-foreground lg:hidden"
      >
        <Info size={18} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/60"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-border bg-surface p-5 pb-8 animate-[reveal-up_0.2s_ease-out]">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Detalles</p>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-hover hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-xl font-semibold text-primary">
                {(contactName ?? contactWaId).charAt(0).toUpperCase()}
              </div>
              <p className="mt-3 text-base font-semibold text-foreground">
                {contactName ?? contactWaId}
              </p>
              <p className="text-sm text-muted">{contactWaId}</p>
            </div>

            {likelyBlocked && <ContactBlockedNotice contactId={contactId} />}
            {aiHandoffRequested && <AiHandoffNotice conversationId={conversationId} />}

            {adSourceId && (
              <div className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
                  <Megaphone size={13} />
                  Vino de un anuncio de Meta Ads
                </p>
                {adHeadline && <p className="mt-1 text-xs text-foreground">{adHeadline}</p>}
                {adBody && <p className="mt-0.5 text-xs text-muted">{adBody}</p>}
              </div>
            )}

            {agents.length > 0 && (
              <div className="mt-6">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                  Asignado a
                </p>
                <ConversationAssignmentControl
                  conversationId={conversationId}
                  agents={agents}
                  assignedAgentId={assignedAgentId}
                />
              </div>
            )}

            <div className="mt-6">
              <ConversationFollowupsToggle
                conversationId={conversationId}
                enabled={followupsEnabled}
                excludedByTag={excludedFromFollowupsByTag}
              />
            </div>

            <div className="mt-6">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                Etiquetas
              </p>
              <ContactTagPicker
                contactId={contactId}
                allTags={allTags}
                assignedTagIds={assignedTagIds}
              />
            </div>

            <div className="mt-6">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                Notas
              </p>
              <NotesEditor contactId={contactId} initialNotes={notes} />
            </div>

            <div className="mt-6">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                Automatizaciones activas
              </p>
              {automations.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {automations.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground"
                    >
                      <Zap size={12} className={a.is_active ? "text-success" : "text-muted"} />
                      {a.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted">Ninguna automatización activa para este contacto.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
