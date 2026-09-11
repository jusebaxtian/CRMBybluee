"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { disconnectPlatformWhatsApp } from "@/app/actions/admin-whatsapp";

export function DisconnectPlatformWhatsAppButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setPassword("");
    setError(null);
  }

  function handleConfirm() {
    if (!password) {
      setError("Ingresa tu contraseña.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await disconnectPlatformWhatsApp(password);
      if (result?.error) {
        setError(result.error);
        return;
      }
      close();
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-red-400 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10"
      >
        Desconectar
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Confirmar desconexión</h3>
              <button type="button" onClick={close} className="text-muted hover:text-foreground">
                <X size={16} />
              </button>
            </div>

            <p className="mb-3 text-sm text-muted">
              Ya no se podrán enviar notificaciones de activación hasta que conectes otro número.
              Ingresa tu contraseña para confirmar.
            </p>

            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
              placeholder="Tu contraseña"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />

            {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                disabled={pending}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-hover disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={pending}
                className="rounded-md bg-red-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {pending ? "Verificando..." : "Desconectar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
