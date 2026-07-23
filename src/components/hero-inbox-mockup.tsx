import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { Check, CheckCheck } from "lucide-react";

const conversations = [
  {
    name: "María López",
    preview: "Hola! ¿Cuánto cuesta el plan mensual?",
    time: "10:32",
    tag: "Nuevo",
    tagColor: "bg-blue-400/15 text-blue-400",
    unread: true,
  },
  {
    name: "Carlos Gómez",
    preview: "Perfecto, envíame el link de pago 🙏",
    time: "09:55",
    tag: "Listo para cerrar",
    tagColor: "bg-success/15 text-success",
    unread: false,
  },
  {
    name: "Valeria Ríos",
    preview: "¿Tienen descuento por volumen?",
    time: "09:20",
    tag: "Negociando",
    tagColor: "bg-warning/15 text-warning",
    unread: true,
  },
  {
    name: "Andrés Mora",
    preview: "Ok, quedamos así entonces 👍",
    time: "Ayer",
    tag: "Cerrado",
    tagColor: "bg-surface-hover text-muted",
    unread: false,
  },
];

export function HeroInboxMockup() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-primary/20 blur-3xl glow-pulse" />

      <div className="float-slow overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl shadow-black/50">
        <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/15 text-success">
            <WhatsAppIcon size={16} />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Bandeja de ByBluee</p>
            <p className="text-[11px] text-muted">WhatsApp Business Cloud API</p>
          </div>
          <span className="ml-auto flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            En línea
          </span>
        </div>

        <div className="flex flex-col divide-y divide-border">
          {conversations.map((c, i) => (
            <div
              key={c.name}
              className="pop-in flex items-center gap-3 px-4 py-3"
              style={{ animationDelay: `${300 + i * 220}ms` }}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                {c.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
                  <span className="shrink-0 text-[10px] text-muted">{c.time}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1 truncate text-xs text-muted">
                    <CheckCheck size={12} className="shrink-0 text-blue-400" />
                    {c.preview}
                  </p>
                  {c.unread && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                  )}
                </div>
                <span
                  className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${c.tagColor}`}
                >
                  {c.tag}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        className="float-slower pop-in absolute -right-6 -top-6 flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 shadow-xl"
        style={{ animationDelay: "1200ms" }}
      >
        <Check size={14} className="text-success" />
        <span className="text-xs font-medium text-foreground">Automatización enviada</span>
      </div>
    </div>
  );
}
