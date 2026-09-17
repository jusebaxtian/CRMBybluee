import { FileText, Download, Check, CheckCheck, AlertCircle, Clock, Reply, ExternalLink, Forward, BadgeDollarSign } from "lucide-react";
import { VoiceMessagePlayer } from "@/components/inbox/voice-message-player";
import { MediaLightbox } from "@/components/inbox/media-lightbox";

type MessageButton =
  | { type: "QUICK_REPLY"; id: string; title: string }
  | { type: "URL"; title: string; url: string };

type Message = {
  id: string;
  direction: string;
  body: string | null;
  status: string;
  message_type: string;
  media_url: string | null;
  media_mime_type: string | null;
  error_detail?: string | null;
  wa_message_id?: string | null;
  context_wa_message_id?: string | null;
  buttons?: MessageButton[] | null;
  created_at: string;
};

function StatusTicks({ status, errorDetail }: { status: string; errorDetail?: string | null }) {
  if (status === "failed")
    return (
      <span title={errorDetail || "No se pudo enviar el mensaje."}>
        <AlertCircle size={13} className="text-red-300" />
      </span>
    );
  if (status === "read") return <CheckCheck size={14} className="text-sky-300" />;
  if (status === "delivered") return <CheckCheck size={14} className="opacity-70" />;
  if (status === "sent") return <Check size={14} className="opacity-70" />;
  return <Clock size={12} className="opacity-70" />;
}

// Short one-line summary of any message, used both for the quoted-reply
// preview inside a bubble and for the composer's "replying to" strip.
function summarize(m: Pick<Message, "message_type" | "body">): string {
  if (m.message_type === "image") return m.body || "📷 Foto";
  if (m.message_type === "video") return "🎥 Video";
  if (m.message_type === "audio") return "🎤 Nota de voz";
  if (m.message_type === "document") return m.body || "📄 Documento";
  if (m.message_type === "sticker") return "🩹 Sticker";
  if (m.message_type === "unsupported") return "⚠️ Contenido no compatible";
  if (m.message_type === "reaction") return m.body ? `Reaccionó ${m.body}` : "Reacción";
  if (m.message_type === "button") return m.body ? `🔘 ${m.body}` : "Tocó un botón";
  return m.body || "Mensaje";
}

const REENVIABLES = new Set(["text", "image", "video", "audio", "document"]);
// Adjuntos con boton de descarga (el documento ya tiene su propio enlace).
const DESCARGABLES = new Set(["image", "video", "audio", "sticker"]);

const EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "application/pdf": "pdf",
};

/** Pasa por /api/descargar para que el navegador descargue en vez de abrir. */
function urlDescarga(m: Pick<Message, "media_url" | "media_mime_type" | "message_type" | "body" | "created_at">): string {
  const ext = (m.media_mime_type && EXTENSION[m.media_mime_type]) || m.media_url!.split(".").pop()?.split("?")[0] || "bin";
  const fecha = new Date(m.created_at).toISOString().slice(0, 10);
  const nombre = m.message_type === "document" && m.body ? m.body : `${m.message_type}-${fecha}.${ext}`;
  return `/api/descargar?url=${encodeURIComponent(m.media_url!)}&nombre=${encodeURIComponent(nombre)}`;
}

export function MessageBubble({
  message: m,
  quotedMessage,
  onReply,
  onForward,
  onRegistrarPago,
}: {
  message: Message;
  quotedMessage?: Message | null;
  onReply?: (target: { waMessageId: string; preview: string }) => void;
  onForward?: (target: { messageId: string; preview: string }) => void;
  /** Solo el administrador de la plataforma: registrar un comprobante recibido como pago. */
  onRegistrarPago?: (target: { messageId: string; preview: string }) => void;
}) {
  const out = m.direction === "out";
  const time = new Date(m.created_at).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (m.message_type === "reaction") {
    return (
      <div className={`flex ${out ? "justify-end" : "justify-start"}`}>
        <p className="max-w-[85%] rounded-full border border-border bg-surface px-3 py-1 text-xs italic text-muted sm:max-w-[70%]">
          {out ? "Reaccionaste" : "Reaccionó"} {m.body ? m.body : "(quitó su reacción)"}
          {quotedMessage && <> a &quot;{summarize(quotedMessage).slice(0, 40)}&quot;</>}
        </p>
      </div>
    );
  }

  // Meta no transmite por la API ciertos contenidos (foto/video "ver una
  // vez", encuestas, eventos, estados reenviados): llegan como "unsupported"
  // y antes se pintaban como una burbuja vacia.
  if (m.message_type === "unsupported") {
    return (
      <div className={`flex ${out ? "justify-end" : "justify-start"}`}>
        <div className="max-w-[85%] rounded-[12px] border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground sm:max-w-[70%]">
          <p className="font-semibold">⚠️ Contenido no compatible con la API de WhatsApp</p>
          <p className="mt-0.5 text-muted">
            Suele ser una foto o video de &quot;ver una vez&quot;, una encuesta, un evento o un estado reenviado. Pídele que lo envíe
            como mensaje normal.
          </p>
          <p className="mt-1 text-[10px] opacity-70">{time}</p>
        </div>
      </div>
    );
  }

  if (m.message_type === "button") {
    return (
      <div className={`flex ${out ? "justify-end" : "justify-start"}`}>
        <p className="flex max-w-[85%] items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs text-primary sm:max-w-[70%]">
          🔘 Tocó: {m.body || "botón"}
        </p>
      </div>
    );
  }

  const canReply = !!m.wa_message_id;
  // Reenviar: texto y adjuntos que sigan disponibles (no plantillas, botones ni reacciones).
  const canForward =
    !!onForward && REENVIABLES.has(m.message_type) && (m.message_type === "text" ? !!m.body : !!m.media_url);
  const botonAccion =
    "shrink-0 rounded-full p-1.5 text-muted opacity-60 hover:bg-surface-hover hover:text-foreground hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100";
  const forwardBtn = canForward && (
    <button
      type="button"
      onClick={() => onForward?.({ messageId: m.id, preview: summarize(m) })}
      title="Reenviar a otro chat"
      aria-label="Reenviar a otro chat"
      className={botonAccion}
    >
      <Forward size={14} />
    </button>
  );

  const pagoBtn = !!onRegistrarPago && !out && ["image", "document"].includes(m.message_type) && (
    <button
      type="button"
      onClick={() => onRegistrarPago?.({ messageId: m.id, preview: summarize(m) })}
      title="Registrar este comprobante como pago"
      className="flex shrink-0 items-center gap-1 self-end rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20"
    >
      <BadgeDollarSign size={13} />
      Registrar pago
    </button>
  );

  return (
    <div className={`group flex items-center gap-1.5 ${out ? "justify-end" : "justify-start"}`}>
      {out && forwardBtn}
      {canReply && out && (
        <button
          type="button"
          onClick={() => onReply?.({ waMessageId: m.wa_message_id!, preview: summarize(m) })}
          title="Responder citando este mensaje"
          className={botonAccion}
        >
          <Reply size={14} />
        </button>
      )}
      <div
        className={`min-w-0 max-w-[85%] rounded-lg px-3 py-2 text-sm sm:max-w-[70%] ${
          out ? "bg-primary text-white" : "bg-surface-hover text-foreground"
        }`}
      >
        {quotedMessage && (
          <div
            className={`mb-1.5 rounded border-l-2 px-2 py-1 text-xs ${
              out ? "border-white/50 bg-white/10 text-white/80" : "border-primary/50 bg-background/60 text-muted"
            }`}
          >
            {summarize(quotedMessage).slice(0, 80)}
          </div>
        )}

        {m.message_type === "image" && m.media_url && (
          // El pie de foto ya se muestra como texto justo debajo, asi que
          // repetirlo en el alt lo duplicaba en pantalla cuando la imagen no
          // cargaba, y lo hacia leer dos veces a un lector de pantalla.
          <MediaLightbox src={m.media_url} kind="image" alt="Imagen" />
        )}

        {m.message_type === "sticker" && m.media_url && (
          // Los stickers son webp, a veces animados: <img> los reproduce solo.
          // Van mas pequenos que una foto y sin recorte, porque suelen tener
          // fondo transparente.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.media_url} alt="Sticker" className="h-32 w-32 object-contain" />
        )}

        {m.message_type === "video" && m.media_url && (
          <MediaLightbox src={m.media_url} kind="video" />
        )}

        {m.message_type === "audio" && m.media_url && (
          <VoiceMessagePlayer src={m.media_url} tint={out ? "outbound" : "default"} />
        )}

        {m.message_type === "document" && m.media_url && (
          <a
            href={urlDescarga(m)}
            className={`mb-1 flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs ${
              out ? "border-white/30" : "border-border"
            }`}
          >
            <FileText size={16} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate">{m.body ?? "Documento"}</span>
            <Download size={14} className="shrink-0" />
          </a>
        )}

        {m.body && m.message_type !== "document" && (
          <p className="whitespace-pre-wrap break-words">{m.body}</p>
        )}

        {DESCARGABLES.has(m.message_type) && m.media_url && (
          <a
            href={urlDescarga(m)}
            className={`mt-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium transition-colors ${
              out ? "text-white/80 hover:bg-white/10 hover:text-white" : "text-muted hover:bg-background hover:text-foreground"
            }`}
            title="Descargar adjunto"
          >
            <Download size={12} />
            Descargar
          </a>
        )}

        {m.buttons && m.buttons.length > 0 && (
          <div className={`mt-2 flex flex-col gap-1 border-t pt-2 ${out ? "border-white/25" : "border-border"}`}>
            {m.buttons.map((b, i) =>
              b.type === "URL" ? (
                <a
                  key={i}
                  href={b.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium ${
                    out ? "bg-white/15 hover:bg-white/25" : "bg-background hover:bg-surface"
                  }`}
                >
                  <ExternalLink size={12} />
                  {b.title}
                </a>
              ) : (
                <span
                  key={i}
                  className={`flex items-center justify-center rounded-md px-2 py-1.5 text-xs font-medium ${
                    out ? "bg-white/15" : "bg-background"
                  }`}
                >
                  {b.title}
                </span>
              )
            )}
          </div>
        )}

        <p className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-70">
          {time}
          {out && <StatusTicks status={m.status} errorDetail={m.error_detail} />}
        </p>

        {/* Tooltips don't work on touch devices — show the reason inline too. */}
        {out && m.status === "failed" && m.error_detail && (
          <p className="mt-1 text-[11px] text-red-200">{m.error_detail}</p>
        )}
      </div>
      {canReply && !out && (
        <button
          type="button"
          onClick={() => onReply?.({ waMessageId: m.wa_message_id!, preview: summarize(m) })}
          title="Responder citando este mensaje"
          className="shrink-0 rounded-full p-1.5 text-muted opacity-60 hover:bg-surface-hover hover:text-foreground hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        >
          <Reply size={14} />
        </button>
      )}
      {!out && forwardBtn}
      {pagoBtn}
    </div>
  );
}
