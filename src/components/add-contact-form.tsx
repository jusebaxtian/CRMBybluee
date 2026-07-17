"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X } from "lucide-react";
import { createContact } from "@/app/actions/contacts";

export function AddContactForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createContact, undefined);

  useEffect(() => {
    if (state && "success" in state) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
      >
        <UserPlus size={14} />
        Agregar contacto
      </button>

      {open && (
        <div className="absolute left-0 z-10 mt-2 w-80 rounded-lg border border-border bg-surface p-4 shadow-lg">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Nuevo contacto</p>
            <button type="button" onClick={() => setOpen(false)} className="text-muted hover:text-foreground">
              <X size={16} />
            </button>
          </div>
          <form action={action} className="flex flex-col gap-3">
            <div>
              <label htmlFor="name" className="mb-1 block text-xs font-medium text-muted">
                Nombre
              </label>
              <input
                id="name"
                name="name"
                type="text"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>
            <div>
              <label htmlFor="phone" className="mb-1 block text-xs font-medium text-muted">
                Número (con código de país)
              </label>
              <input
                id="phone"
                name="phone"
                type="text"
                required
                placeholder="573001234567"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>
            {state && "error" in state && <p className="text-xs text-red-400">{state.error}</p>}
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {pending ? "Guardando..." : "Guardar contacto"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
