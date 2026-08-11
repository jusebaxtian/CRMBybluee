"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { updateWorkspaceRenewalDate } from "@/app/actions/admin";

export function EditRenewalDateButton({
  workspaceId,
  currentDate,
}: {
  workspaceId: string;
  currentDate: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentDate ? currentDate.slice(0, 10) : "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setPending(true);
    setError(null);
    const result = await updateWorkspaceRenewalDate(workspaceId, value);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-muted hover:text-foreground"
        title="Editar fecha de renovación/prueba"
      >
        <Pencil size={11} />
      </button>
    );
  }

  return (
    <div className="mt-1 flex items-center gap-1">
      <input
        type="date"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="rounded-md border border-border bg-background px-1.5 py-0.5 text-xs text-foreground outline-none focus:border-primary"
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={pending}
        className="rounded-md bg-primary px-1.5 py-0.5 text-xs text-white hover:bg-primary-hover disabled:opacity-50"
      >
        {pending ? "..." : "OK"}
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        disabled={pending}
        className="text-xs text-muted hover:text-foreground"
      >
        ✕
      </button>
      {error && <p className="w-full text-[10px] text-red-400">{error}</p>}
    </div>
  );
}
