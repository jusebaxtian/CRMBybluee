"use client";

import { useActionState, useEffect, useState } from "react";
import { changeOwnPassword } from "@/app/actions/account";

export function ChangePasswordButton() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(changeOwnPassword, undefined);

  useEffect(() => {
    if (state && "success" in state) {
      const timeout = setTimeout(() => setOpen(false), 1200);
      return () => clearTimeout(timeout);
    }
  }, [state]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-md px-2 py-1.5 text-left text-sm text-foreground hover:bg-surface-hover"
      >
        Cambiar contraseña
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
            <h3 className="mb-4 text-sm font-semibold text-foreground">Cambiar contraseña</h3>
            <form action={action} className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  Nueva contraseña
                </label>
                <input
                  name="newPassword"
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
                  name="confirmPassword"
                  type="password"
                  required
                  minLength={8}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>

              {state && "error" in state && (
                <p className="text-xs text-red-400">{state.error}</p>
              )}
              {state && "success" in state && (
                <p className="text-xs text-success">Contraseña actualizada.</p>
              )}

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
