import { FileText, Download, Check, CheckCheck, AlertCircle, Clock, Reply, ExternalLink } from "lucide-react";

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
  if (m.message_type === "reaction") return m.body ? `Reaccionó ${m.body}` : "Reacción";
  if (m.message_type === "button") return m.body ? `🔘 ${m.body}` : "Tocó un botón";
  return m.body || "Mensaje";
}

export function MessageBubble({
  message: m,
  quotedMessage,
  onReply,
}: {
  message: Message;
  quotedMessage?: Message | null;
  onReply?: (target: { waMessageId: string; preview: string }) => void;
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

  return (
    <div className={`group flex items-center gap-1.5 ${out ? "justify-end" : "justify-start"}`}>
      {canReply && out && (
        <button
          type="button"
          onClick={() => onReply?.({ waMessageId: m.wa_message_id!, preview: summarize(m) })}
          title="Responder citando este mensaje"
          className="shrink-0 rounded-full p-1.5 text-muted opacity-60 hover:bg-surface-hover hover:text-foreground hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
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
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={m.media_url}
            alt={m.body ?? "Imagen"}
            className="mb-1 max-h-72 w-full rounded-md object-cover"
          />
        )}

        {m.message_type === "video" && m.media_url && (
          <video src={m.media_url} controls className="mb-1 max-h-72 w-full rounded-md" />
        )}

        {m.message_type === "audio" && m.media_url && (
          <audio src={m.media_url} controls className="mb-1 h-10 w-56 max-w-full" />
        )}

        {m.message_type === "document" && m.media_url && (
          <a
            href={m.media_url}
            target="_blank"
            rel="noopener noreferrer"
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
    </div>
  );
}
