"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignConversationAgent } from "@/app/actions/agents";

type Agent = { id: string; name: string | null; email: string };

export function ConversationAssignmentControl({
  conversationId,
  agents,
  assignedAgentId,
}: {
  conversationId: string;
  agents: Agent[];
  assignedAgentId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleChange(value: string) {
    startTransition(async () => {
      await assignConversationAgent(conversationId, value || null);
      router.refresh();
    });
  }

  return (
    <select
      defaultValue={assignedAgentId ?? ""}
      onChange={(e) => handleChange(e.target.value)}
      disabled={pending}
      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary disabled:opacity-50"
    >
      <option value="">Sin asignar</option>
      {agents.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name ?? a.email}
        </option>
      ))}
    </select>
  );
}
