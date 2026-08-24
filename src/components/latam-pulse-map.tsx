"use client";

// A spinning "globe" made of pure CSS: the ring rotates continuously while
// each country marker counter-rotates at the same speed so its label stays
// upright as it orbits — no 3D library needed.
const countries = [
  { code: "🇨🇴", name: "Colombia", angle: 0 },
  { code: "🇲🇽", name: "México", angle: 45 },
  { code: "🇬🇹", name: "Guatemala", angle: 90 },
  { code: "🇺🇸", name: "EE.UU.", angle: 135 },
  { code: "🇦🇷", name: "Argentina", angle: 180 },
  { code: "🇨🇱", name: "Chile", angle: 225 },
  { code: "🇵🇪", name: "Perú", angle: 270 },
  { code: "🇪🇨", name: "Ecuador", angle: 315 },
];

const ORBIT_DURATION = "26s";

export function LatamPulseMap() {
  return (
    <div className="relative mx-auto flex h-80 w-full max-w-md items-center justify-center sm:h-96">
      {/* the sphere */}
      <div className="absolute h-44 w-44 rounded-full bg-[radial-gradient(circle_at_35%_30%,_rgba(27,168,74,0.35),_rgba(27,168,74,0.05)_60%,_transparent_75%)] sm:h-52 sm:w-52" />
      <div className="absolute h-44 w-44 rounded-full border border-primary/30 sm:h-52 sm:w-52" />
      <div className="absolute h-44 w-32 rounded-[50%] border border-primary/15 sm:h-52 sm:w-40" />
      <div className="absolute h-24 w-44 rounded-[50%] border border-primary/15 sm:h-28 sm:w-52" />

      {/* orbit rings */}
      <div className="absolute h-full w-full rounded-full border border-dashed border-border orbit-spin" />
      <div className="absolute h-[82%] w-[82%] rounded-full border border-dashed border-border/70 orbit-spin-reverse" />

      {/* rotating ring carrying the country markers */}
      <div
        className="absolute h-[68%] w-[68%] animate-[orbit-spin_var(--orbit-duration)_linear_infinite]"
        style={{ ["--orbit-duration" as string]: ORBIT_DURATION }}
      >
        {countries.map((c) => (
          <div
            key={c.name}
            className="absolute left-1/2 top-1/2 h-0 w-0"
            style={{ transform: `rotate(${c.angle}deg) translateY(-104px)` }}
          >
            <div
              className="absolute -ml-16 flex w-32 animate-[orbit-spin_var(--orbit-duration)_linear_infinite_reverse] flex-col items-center gap-1"
            >
              <span className="dot-pulse relative flex h-2.5 w-2.5 items-center justify-center rounded-full bg-primary" />
              <span className="whitespace-nowrap rounded-full border border-border bg-surface px-1.5 py-0.5 text-[10px] text-muted">
                {c.code} {c.name}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
