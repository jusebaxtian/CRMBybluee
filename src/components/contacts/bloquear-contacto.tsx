"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, ShieldCheck } from "lucide-react";
import { bloquearContacto, desbloquearContacto } from "@/app/actions/bloqueos";

/**
 * Bloquear o desbloquear al contacto en WhatsApp.
 *
 * Se confirma antes de bloquear: es una acción que corta la comunicación de
 * verdad --Meta deja de entregarnos sus mensajes-- y no basta con poder
 * deshacerla después.
 */
export function BloquearContacto({
  contactId,
  bloqueado,
  nombre,
}: {
  contactId: string;
  bloqueado: boolean;
  nombre: string;
}) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trabajando, trabajar] = useTransition();

  const ejecutar = (bloquear: boolean) =>
    trabajar(async () => {
      setError(null);
      const r = bloquear ? await bloquearContacto(contactId) : await desbloquearContacto(contactId);
      if ("error" in r && r.error) {
        setError(r.error);
        return;
      }
      setConfirmando(false);
      router.refresh();
    });

  if (bloqueado) {
    return (
      <div className="flex flex-col gap-1">
        <button
          type="button"
          disabled={trabajando}
          onClick={() => ejecutar(false)}
          className="flex items-center justify-center gap-1.5 rounded-[9px] border border-border px-3 py-2 text-[13px] font-medium text-foreground hover:bg-surface-hover disabled:opacity-50"
        >
          <ShieldCheck size={13} />
          {trabajando ? "Desbloqueando…" : "Desbloquear"}
        </button>
        {error && <span className="text-[11px] leading-relaxed text-red-400">{error}</span>}
      </div>
    );
  }

  if (!confirmando) {
    return (
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="flex items-center justify-center gap-1.5 rounded-[9px] border border-border px-3 py-2 text-[13px] font-medium text-muted hover:border-red-400/50 hover:text-red-400"
        >
          <Ban size={13} />
          Bloquear contacto
        </button>
        {error && <span className="text-[11px] leading-relaxed text-red-400">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-red-400/40 bg-red-400/10 p-2.5">
      <p className="text-[11.5px] leading-relaxed text-foreground">
        ¿Bloquear a <strong>{nombre}</strong>? WhatsApp dejará de entregarte sus mensajes y no le llegarán
        campañas ni automatizaciones. Puedes desbloquearlo cuando quieras.
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={trabajando}
          onClick={() => ejecutar(true)}
          className="rounded-[8px] bg-red-400 px-2.5 py-1.5 text-[12.5px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {trabajando ? "Bloqueando…" : "Sí, bloquear"}
        </button>
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          className="text-[12.5px] text-muted hover:text-foreground"
        >
          Cancelar
        </button>
      </div>
      {error && <span className="text-[11px] leading-relaxed text-red-400">{error}</span>}
    </div>
  );
}
