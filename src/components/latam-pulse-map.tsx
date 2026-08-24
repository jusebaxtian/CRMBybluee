// Decorative — not a claim of per-country operation, just a visual anchor
// for "hecho para negocios de Latinoamérica hispanohablante".
const countries = [
  { code: "🇨🇴", name: "Colombia", top: "52%", left: "38%" },
  { code: "🇲🇽", name: "México", top: "22%", left: "18%" },
  { code: "🇵🇪", name: "Perú", top: "66%", left: "34%" },
  { code: "🇨🇱", name: "Chile", top: "82%", left: "40%" },
  { code: "🇦🇷", name: "Argentina", top: "80%", left: "52%" },
  { code: "🇪🇨", name: "Ecuador", top: "58%", left: "28%" },
  { code: "🇬🇹", name: "Guatemala", top: "30%", left: "16%" },
  { code: "🇺🇸", name: "EE.UU.", top: "8%", left: "22%" },
];

export function LatamPulseMap() {
  return (
    <div className="relative mx-auto flex h-72 w-full max-w-md items-center justify-center sm:h-80">
      <div className="orbit-spin absolute h-full w-full rounded-full border border-dashed border-border" />
      <div className="orbit-spin-reverse absolute h-[80%] w-[80%] rounded-full border border-dashed border-border/70" />
      <div className="absolute h-40 w-40 rounded-full bg-primary/10 blur-2xl" />

      <div className="relative h-full w-full">
        {countries.map((c) => (
          <div
            key={c.name}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
            style={{ top: c.top, left: c.left }}
          >
            <span className="dot-pulse relative flex h-2.5 w-2.5 items-center justify-center rounded-full bg-primary" />
            <span className="rounded-full border border-border bg-surface px-1.5 py-0.5 text-[10px] text-muted">
              {c.code} {c.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
