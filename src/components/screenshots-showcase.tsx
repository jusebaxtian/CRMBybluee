"use client";

import { useEffect, useState } from "react";
import { Image as ImageIcon } from "lucide-react";

type Screenshot = {
  key: string;
  title: string;
  text: string;
};

const ROTATE_MS = 3800;

export function ScreenshotsShowcase({ items }: { items: Screenshot[] }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      setActive((i) => (i + 1) % items.length);
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, [paused, items.length]);

  const current = items[active];

  return (
    <div
      className="mx-auto max-w-3xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex flex-wrap justify-center gap-2">
        {items.map((s, i) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setActive(i)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
              i === active
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            {s.title}
          </button>
        ))}
      </div>

      <div className="relative mt-6 overflow-hidden rounded-2xl border border-border bg-surface">
        <div
          key={current.key}
          className="bubble-in flex aspect-video items-center justify-center bg-background/60 text-muted"
        >
          <div className="flex flex-col items-center gap-2">
            <ImageIcon size={28} />
            <span className="text-xs">Captura próximamente</span>
          </div>
        </div>
        <div key={`${current.key}-caption`} className="bubble-in p-4">
          <h3 className="text-sm font-medium text-foreground">{current.title}</h3>
          <p className="mt-1 text-xs text-muted">{current.text}</p>
        </div>

        <div className="flex gap-1.5 px-4 pb-4">
          {items.map((s, i) => (
            <span
              key={s.key}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i === active ? "bg-primary" : "bg-border"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
