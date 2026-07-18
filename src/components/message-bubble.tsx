import { FileText, Download } from "lucide-react";

type Message = {
  id: string;
  direction: string;
  body: string | null;
  status: string;
  message_type: string;
  media_url: string | null;
  media_mime_type: string | null;
  created_at: string;
};

export function MessageBubble({ message: m }: { message: Message }) {
  const out = m.direction === "out";
  const time = new Date(m.created_at).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`flex ${out ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm sm:max-w-[70%] ${
          out ? "bg-primary text-white" : "bg-surface-hover text-foreground"
        }`}
      >
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

        {m.body && m.message_type !== "document" && <p className="whitespace-pre-wrap">{m.body}</p>}

        <p className="mt-1 text-[10px] opacity-70">{time}</p>
      </div>
    </div>
  );
}
