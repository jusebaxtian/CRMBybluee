"use client";

import { CheckCircle2, ExternalLink, Loader2, Send, Video, X } from "lucide-react";

export type VistaConfirmacion =
  | { para: string; via: "texto" | "plantilla"; texto: string; boton: string | null; aviso: string | null; puedeEnviar: boolean }
  | { error: string; faltaPlantilla?: boolean };

/**
 * Lo que se ve justo despues de programar una cita: el resumen, el mensaje que se le
 * va a mandar al cliente (tal cual lo recibira) y el boton para enviarlo desde ahi,
 * sin ir a la Agenda.
 */
export function ConfirmacionDeCita({
  titulo,
  fechaLegible,
  meetUrl,
  vista,
  error,
  aviso,
  faltaPlantilla,
  enviadaA,
  pending,
  onEnviar,
  onCrearPlantillas,
  onCerrar,
}: {
  titulo: string;
  fechaLegible: string;
  meetUrl: string | null;
  vista: VistaConfirmacion | null;
  error: string | null;
  aviso: string | null;
  faltaPlantilla: boolean;
  enviadaA: string | null;
  pending: boolean;
  onEnviar: () => void;
  onCrearPlantillas: () => void;
  onCerrar: () => void;
}) {
  const v = vista && "para" in vista ? vista : null;
  const fallo = vista && "error" in vista ? vista : null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" aria-label="Cerrar" onClick={onCerrar} className="absolute inset-0 bg-black/60" />
      <div className="relative flex max-h-[92vh] w-full flex-col gap-3 overflow-y-auto rounded-t-2xl border border-border bg-surface p-4 shadow-[0_24px_60px_rgba(0,0,0,0.5)] sm:max-w-md sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold text-success">
            <CheckCircle2 size={16} /> Cita programada
          </p>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="text-muted hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        <div className="rounded-[9px] border border-border bg-background px-3 py-2 text-sm">
          <p className="font-medium text-foreground">{titulo}</p>
          <p className="text-xs text-muted">{fechaLegible} · hora de Colombia</p>
          {meetUrl && (
            <a href={meetUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">
              <Video size={12} /> Reunión de Meet <ExternalLink size={10} />
            </a>
          )}
        </div>

        {enviadaA ? (
          <p className="flex items-center gap-2 rounded-[9px] border border-success/40 bg-success/10 px-3 py-2.5 text-sm text-success">
            <CheckCircle2 size={16} /> Confirmación enviada a {enviadaA}. Ya la ves en el chat.
          </p>
        ) : (
          <>
            {!vista && (
              <p className="flex items-center gap-2 text-xs text-muted">
                <Loader2 size={13} className="animate-spin" /> Preparando el mensaje para el cliente…
              </p>
            )}
            {v && (
              <div>
                <p className="text-xs font-medium text-muted">Mensaje para {v.para}</p>
                <div className="mt-1 rounded-[12px] rounded-tl-sm border border-border bg-background px-3 py-2.5">
                  <p className="whitespace-pre-line text-[13px] leading-relaxed text-foreground">{v.texto}</p>
                  {v.boton && (
                    <p className="mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-border py-1.5 text-xs font-semibold text-primary">
                      <Video size={12} /> {v.boton}
                    </p>
                  )}
                </div>
                {v.aviso && <p className={`mt-1.5 text-[11px] ${v.puedeEnviar ? "text-muted" : "text-warning"}`}>{v.aviso}</p>}
              </div>
            )}
            {fallo && <p className="text-xs text-warning">{fallo.error}</p>}
            {error && <p className="text-xs text-error">{error}</p>}
            {(faltaPlantilla || fallo?.faltaPlantilla) && (
              <button type="button" onClick={onCrearPlantillas} disabled={pending} className="rounded-[9px] border border-primary px-3 py-2 text-xs text-primary hover:bg-primary/10 disabled:opacity-50">
                Crear plantillas de confirmación de citas
              </button>
            )}
            {aviso && <p className="text-xs text-success">{aviso}</p>}
          </>
        )}

        <div className="flex items-center gap-2">
          {!enviadaA && (
            <button
              type="button"
              onClick={onEnviar}
              disabled={pending || !v || !v.puedeEnviar}
              className="flex flex-1 items-center justify-center gap-2 rounded-[9px] bg-primary px-3 py-2 text-sm font-bold text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {pending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Enviar confirmación por WhatsApp
            </button>
          )}
          <button
            type="button"
            onClick={onCerrar}
            className={`rounded-[9px] border border-border px-3 py-2 text-sm text-muted hover:text-foreground ${enviadaA ? "flex-1" : ""}`}
          >
            {enviadaA ? "Listo" : "Ahora no"}
          </button>
        </div>
      </div>
    </div>
  );
}
