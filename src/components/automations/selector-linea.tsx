"use client";

export type LineaOption = { id: string; label: string | null; display_phone_number: string; waba_id?: string };

export function etiquetaLinea(l: LineaOption) {
  return l.label ? `${l.label} · ${l.display_phone_number}` : l.display_phone_number;
}

/**
 * "¿Para qué línea?" en automatizaciones y seguimientos. Solo se muestra
 * cuando el espacio tiene más de una línea; con una sola no hay nada que
 * elegir y la regla aplica a esa línea (migración 0109).
 */
export function SelectorLinea({
  lineas,
  value,
  onChange,
  ayuda,
}: {
  lineas: LineaOption[];
  value: string;
  onChange: (id: string) => void;
  ayuda: string;
}) {
  if (lineas.length < 2) return null;
  return (
    <div>
      <label htmlFor="whatsappAccountId" className="mb-1 block text-sm font-medium text-muted">
        ¿Para qué línea aplica?
      </label>
      <select
        id="whatsappAccountId"
        name="whatsappAccountId"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[9px] border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary"
      >
        <option value="">Todas las líneas</option>
        {lineas.map((l) => (
          <option key={l.id} value={l.id}>
            {etiquetaLinea(l)}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-muted">{ayuda}</p>
    </div>
  );
}

/** Plantillas utilizables según la línea elegida (las plantillas viven en la WABA de la línea). */
export function plantillasParaLinea<T extends { waba_id?: string }>(
  templates: T[],
  lineas: LineaOption[],
  whatsappAccountId: string
): T[] {
  if (!whatsappAccountId) return templates;
  const waba = lineas.find((l) => l.id === whatsappAccountId)?.waba_id;
  if (!waba) return templates;
  return templates.filter((t) => !t.waba_id || t.waba_id === waba);
}
