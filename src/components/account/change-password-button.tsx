"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { changeOwnPassword } from "@/app/actions/account";
import { updateOwnerPassword } from "@/app/actions/admin";

export function ChangePasswordButton({
  impersonatedOwnerId = null,
  workspaceId = null,
}: {
  impersonatedOwnerId?: string | null;
  workspaceId?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isImpersonating = !!impersonatedOwnerId;

  function reset() {
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setSuccess(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setPending(true);
    setError(null);

    const result =
      isImpersonating && impersonatedOwnerId && workspaceId
        ? await updateOwnerPassword(impersonatedOwnerId, newPassword, workspaceId)
        : await (async () => {
            const fd = new FormData();
            fd.set("newPassword", newPassword);
            fd.set("confirmPassword", confirmPassword);
            return changeOwnPassword(undefined, fd);
          })();

    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setSuccess(true);
    router.refresh();
    setTimeout(() => setOpen(false), 1200);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="w-full rounded-md px-2 py-1.5 text-left text-sm text-foreground hover:bg-surface-hover"
      >
        {isImpersonating ? "Establecer contraseña del cliente" : "Cambiar contraseña"}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 text-sm font-semibold text-foreground">
              {isImpersonating ? "Establecer contraseña del cliente" : "Cambiar contraseña"}
            </h3>
            {isImpersonating && (
              <p className="mb-4 text-xs text-warning">
                Estás en modo soporte — esto cambia la contraseña del cliente que estás viendo, no la tuya.
              </p>
            )}
            <form onSubmit={handleSubmit} className={`flex flex-col gap-3 ${isImpersonating ? "" : "mt-4"}`}>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  Nueva contraseña
                </label>
                <input
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  type="password"
                  required
                  minLength={8}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  Confirmar contraseña
                </label>
                <input
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  type="password"
                  required
                  minLength={8}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}
              {success && <p className="text-xs text-success">Contraseña actualizada.</p>}

              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-1.5 text-xs text-muted hover:text-foreground"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                >
                  {pending ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
