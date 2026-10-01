"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, KeyRound } from "lucide-react";
import { enviarCodigoPorElChat } from "@/app/actions/recuperacion";

/**
 * Mandarle al cliente su código de acceso por este mismo chat.
 *
 * Solo aparece para el administrador de la plataforma: es una herramienta de
 * soporte, no algo que un cliente deba ver en su propio panel.
 */
export function EnviarCodigoAcceso({
  contactId,
  conversationId,
}: {
  contactId: string;
  conversationId: string;
}) {
  const router = useRouter();
  const [enviando, enviar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={enviando}
        onClick={() =>
          enviar(async () => {
            setError(null);
            setListo(null);
            const r = await enviarCodigoPorElChat(contactId, conversationId);
            if ("error" in r && r.error) {
              setError(r.error);
              return;
            }
            if ("correo" in r && r.correo) setListo(r.correo);
            router.refresh();
          })
        }
        className="flex items-center justify-center gap-1.5 rounded-[9px] border border-border px-3 py-2 text-[13px] font-medium text-foreground hover:border-primary hover:text-primary disabled:opacity-50"
      >
        {listo ? <Check size={13} className="text-success" /> : <KeyRound size={13} />}
        {enviando ? "Enviando…" : listo ? "Código enviado" : "Enviar código de acceso"}
      </button>
      {listo && (
        <span className="text-[11px] leading-relaxed text-muted">
          Se lo mandamos con los pasos y su correo ({listo}). Vence en 10 minutos.
        </span>
      )}
      {error && <span className="text-[11px] leading-relaxed text-red-400">{error}</span>}
    </div>
  );
}
