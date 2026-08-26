import { FileText, ExternalLink } from "lucide-react";
import { WhatsAppIcon } from "@/components/whatsapp-icon";

type TemplateButton = { type: "URL" | "QUICK_REPLY"; text: string; url?: string };

// Renders a template the way it actually shows up as a WhatsApp message —
// header media/text, body, and buttons — instead of just the raw body text
// the templates list used to show, which made it impossible to tell at a
// glance whether a template had an image/video/document header or buttons.
export function TemplatePreview({
  headerFormat,
  headerText,
  headerMediaUrl,
  bodyText,
  buttons,
}: {
  headerFormat: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | null;
  headerText: string | null;
  headerMediaUrl: string | null;
  bodyText: string | null;
  buttons: TemplateButton[] | null;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-background">
      <div className="flex items-center gap-1.5 border-b border-border bg-surface-hover px-3 py-1.5 text-[10px] text-muted">
        <WhatsAppIcon size={10} className="text-success" />
        Así se ve en WhatsApp
      </div>

      <div className="p-3">
        <div className="max-w-[85%] rounded-lg rounded-tl-sm bg-surface-hover text-sm text-foreground">
          {headerFormat === "IMAGE" && (
            headerMediaUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={headerMediaUrl}
                alt="Encabezado"
                className="max-h-40 w-full rounded-t-lg object-cover"
              />
            ) : (
              <div className="flex h-24 w-full items-center justify-center rounded-t-lg bg-surface text-muted">
                🖼️ Imagen de ejemplo
              </div>
            )
          )}

          {headerFormat === "VIDEO" && (
            headerMediaUrl ? (
              <video src={headerMediaUrl} controls className="max-h-40 w-full rounded-t-lg" />
            ) : (
              <div className="flex h-24 w-full items-center justify-center rounded-t-lg bg-surface text-muted">
                🎥 Video de ejemplo
              </div>
            )
          )}

          {headerFormat === "DOCUMENT" && (
            <div className="flex items-center gap-2 rounded-t-lg bg-surface px-3 py-2.5 text-xs text-muted">
              <FileText size={16} className="shrink-0" />
              Documento adjunto
            </div>
          )}

          <div className="px-3 py-2">
            {headerFormat === "TEXT" && headerText && (
              <p className="mb-1 font-semibold text-foreground">{headerText}</p>
            )}
            <p className="whitespace-pre-wrap break-words">
              {bodyText || <span className="italic text-muted">Sin texto en el cuerpo</span>}
            </p>
          </div>

          {buttons && buttons.length > 0 && (
            <div className="flex flex-col border-t border-border">
              {buttons.map((b, i) => (
                <div
                  key={i}
                  className="flex items-center justify-center gap-1.5 border-t border-border px-3 py-2 text-xs font-medium text-primary first:border-t-0"
                >
                  {b.type === "URL" && <ExternalLink size={12} />}
                  {b.text}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
