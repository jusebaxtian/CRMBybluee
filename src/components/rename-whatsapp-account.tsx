"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X } from "lucide-react";
import { renameWhatsAppAccount } from "@/app/actions/whatsapp";

export function RenameWhatsAppAccount({
  accountId,
  label,
  fallback,
}: {
  accountId: string;
  label: string | null;
  fallback: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(label ?? "");
  const [pending, setPending] = useState(false);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="group flex items-center gap-1.5 text-left"
        title="Renombrar canal"
      >
        <h2 className="text-lg font-semibold text-foreground">{label || fallback}</h2>
        <Pencil size={13} className="text-muted opacity-0 group-hover:opacity-100" />
      </button>
    );
  }

  async function save() {
    setPending(true);
    await renameWhatsAppAccount(accountId, value);
    setPending(false);
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && save()}
        placeholder={fallback}
        className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:border-primary"
      />
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="text-success hover:text-success/80"
        title="Guardar"
      >
        <Check size={16} />
      </button>
      <button
        type="button"
        onClick={() => {
          setValue(label ?? "");
          setEditing(false);
        }}
        className="text-muted hover:text-foreground"
        title="Cancelar"
      >
        <X size={16} />
      </button>
    </div>
  );
}
