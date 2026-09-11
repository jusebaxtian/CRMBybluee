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
function Pill({ text, color }: { text: string; color: BadgeColor }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${colorClasses[color]}`}
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
}: {
  value: number;
  label: string;
  color: BadgeColor;
}) {
  return <Pill text={`${value} ${label}`} color={color} />;
}

// Status variant: just a label, for campaign/automation/etc. status chips
// ("Completada", "Enviando...", "Falló") in the same pill style.
export function StatusBadge({ label, color }: { label: string; color: BadgeColor }) {
  return <Pill text={label} color={color} />;
}
