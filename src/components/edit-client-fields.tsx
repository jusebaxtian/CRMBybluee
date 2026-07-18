"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateWorkspaceName, updateOwnerEmail, updateOwnerPassword } from "@/app/actions/admin";

function EditableField({
  label,
  initialValue,
  type = "text",
  placeholder,
  onSave,
}: {
  label: string;
  initialValue: string;
  type?: string;
  placeholder?: string;
  onSave: (value: string) => Promise<{ error?: string } | undefined>;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setPending(true);
    setError(null);
    const result = await onSave(value);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          className="w-full max-w-xs rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {pending ? "..." : "Guardar"}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

export function EditClientFields({
  workspaceId,
  workspaceName,
  ownerId,
  ownerEmail,
}: {
  workspaceId: string;
  workspaceName: string;
  ownerId: string | null;
  ownerEmail: string | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      <EditableField
        label="Nombre del cliente / negocio"
        initialValue={workspaceName}
        onSave={(v) => updateWorkspaceName(workspaceId, v)}
      />
      {ownerId ? (
        <>
          <EditableField
            label="Correo de acceso"
            initialValue={ownerEmail ?? ""}
            type="email"
            onSave={(v) => updateOwnerEmail(ownerId, v, workspaceId)}
          />
          <EditableField
            label="Nueva contraseña"
            initialValue=""
            type="password"
            placeholder="Mínimo 8 caracteres"
            onSave={(v) => updateOwnerPassword(ownerId, v, workspaceId)}
          />
        </>
      ) : (
        <p className="text-xs text-muted">Este workspace no tiene un usuario propietario.</p>
      )}
    </div>
  );
}
