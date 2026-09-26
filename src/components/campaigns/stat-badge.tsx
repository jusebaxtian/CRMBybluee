const colorClasses = {
  success: "border-success text-success",
  danger: "border-red-400 text-red-400",
  muted: "border-border text-muted",
  accent: "border-primary text-primary",
  warning: "border-amber-400 text-amber-400",
} as const;

type BadgeColor = keyof typeof colorClasses;

// Pill-shaped, outline-only badge — no fill — matching the client's
// reference style for tag/status chips.
// `title` pinta el motivo del fallo al pasar el cursor. Con el cursor de
// ayuda para que se note que hay algo que leer.
function Pill({ text, color, title }: { text: string; color: BadgeColor; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${
        title ? "cursor-help" : ""
      } ${colorClasses[color]}`}
    >
      {text}
    </span>
  );
}

// Stat variant: a count plus a short label ("12 enviados").
export function StatBadge({
  value,
  label,
  color,
  title,
}: {
  value: number;
  label: string;
  color: BadgeColor;
  title?: string;
}) {
  return <Pill text={`${value} ${label}`} color={color} title={title} />;
}

// Status variant: just a label, for campaign/automation/etc. status chips
// ("Completada", "Enviando...", "Falló") in the same pill style.
export function StatusBadge({
  label,
  color,
  title,
}: {
  label: string;
  color: BadgeColor;
  title?: string;
}) {
  return <Pill text={label} color={color} title={title} />;
}
