"use client";

import { useActionState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { sendMessage } from "@/app/actions/whatsapp";

type State = Awaited<ReturnType<typeof sendMessage>> | undefined;

export function MessageComposer({ conversationId }: { conversationId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  const [state, action, pending] = useActionState<State, FormData>(
    async (_prev, formData) => {
      const body = String(formData.get("body") ?? "").trim();
      if (!body) return undefined;
      const result = await sendMessage({ conversationId, body });
      if (!("error" in result)) {
        formRef.current?.reset();
        router.refresh();
      }
      return result;
    },
    undefined
  );

  return (
    <div className="border-t border-border p-4">
      <form ref={formRef} action={action} className="flex items-center gap-2">
        <input
          name="body"
          type="text"
          placeholder="Escribe un mensaje..."
          autoComplete="off"
          required
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={pending}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white disabled:opacity-50"
        >
          <Send size={16} />
        </button>
      </form>
      {state && "error" in state && (
        <p className="mt-2 text-xs text-red-400">{state.error}</p>
      )}
    </div>
  );
}
