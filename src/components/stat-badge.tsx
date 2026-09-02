const colorClasses: Record<"success" | "danger" | "muted", string> = {
  success: "border-success text-success",
  danger: "border-red-400 text-red-400",
  muted: "border-border text-muted",
};

// Round, outline-only badge — no fill — with the number on top and a short
// label underneath, used for at-a-glance campaign send results (sent/
// failed/pending) wherever a compact stat needs to stand on its own.
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
    <div
      className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full border ${colorClasses[color]}`}
    >
      <span className="text-sm font-semibold leading-none">{value}</span>
      <span className="mt-1 text-[9px] leading-none">{label}</span>
    </div>
  );
}
