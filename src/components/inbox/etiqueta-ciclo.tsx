import type { Ciclo } from "@/lib/inbox/ciclo-de-plan";

/**
 * Colores del ciclo del plan, los mismos en la lista, el encabezado y el panel
 * del cliente: azul mensual, naranja semestral, violeta anual, rosa DEMO. Distintos del
 * verde de siempre, que queda para quien no tiene etiqueta.
 *
 * Las clases van completas (no armadas con plantillas) para que Tailwind las vea.
 */
export const ESTILO_CICLO: Record<Ciclo, { texto: string; avatar: string; chip: string }> = {
  mensual: { texto: "Mensual", avatar: "bg-info/15 text-info", chip: "bg-info/15 text-info" },
  semestral: { texto: "Semestral", avatar: "bg-warning/15 text-warning", chip: "bg-warning/15 text-warning" },
  anual: { texto: "Anual", avatar: "bg-accent-purple/15 text-accent-purple", chip: "bg-accent-purple/15 text-accent-purple" },
  // Rosa: ningun otro estado lo usa, y una cuenta DEMO tiene que verse distinta de las que pagan.
  demo: { texto: "DEMO", avatar: "bg-pink-500/15 text-pink-500", chip: "bg-pink-500/15 text-pink-500" },
};

/** Clase del circulo con la inicial: la del ciclo si lo hay, si no la de siempre. */
export function claseAvatar(ciclo: Ciclo | null | undefined, porDefecto: string): string {
  return ciclo ? ESTILO_CICLO[ciclo].avatar : porDefecto;
}

/** Insignia "Mensual / Semestral / Anual" junto al nombre. No dibuja nada sin ciclo. */
export function EtiquetaCiclo({ ciclo }: { ciclo: Ciclo | null | undefined }) {
  if (!ciclo) return null;
  const e = ESTILO_CICLO[ciclo];
  return (
    <span
      title={`Plan ${e.texto.toLowerCase()}`}
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold leading-none ${e.chip}`}
    >
      {e.texto}
    </span>
  );
}
