"use client";

import { Check } from "lucide-react";

export const TAG_COLORS = [
  "#1ba84a",
  "#7c5cff",
  "#22c55e",
  "#eab308",
  "#ef4444",
  "#3b82f6",
  "#ec4899",
  "#f97316",
  "#14b8a6",
  "#6366f1",
  "#a855f7",
  "#64748b",
];

export function ColorSwatchPicker({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <input type="hidden" name={name} value={value} />
      {TAG_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          title={c}
          className="flex h-6 w-6 items-center justify-center rounded-full ring-offset-2 ring-offset-surface transition"
          style={{ backgroundColor: c, boxShadow: value === c ? `0 0 0 2px ${c}` : undefined }}
        >
          {value === c && <Check size={13} className="text-white" strokeWidth={3} />}
        </button>
      ))}
    </div>
  );
}
