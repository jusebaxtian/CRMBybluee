const colorClasses: Record<"success" | "danger" | "muted", string> = {
  success: "border-success text-success",
  danger: "border-red-400 text-red-400",
  muted: "border-border text-muted",
};

// Pill-shaped, outline-only badge — no fill — value and label inline,
// matching the client's reference style for tag/status chips.
export function StatBadge({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: "success" | "danger" | "muted";
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${colorClasses[color]}`}
    >
      {value} {label}
    </span>
  );
}
