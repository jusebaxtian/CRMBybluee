"use client";

import { Info } from "lucide-react";
import {
  ORIGENES,
  etiquetaDeOrigen,
  type VariablePersonalizada,
  type OrigenVariable,
  type VariableDePlantilla,
} from "@/lib/contactos/variables";

/**
 * Con qué se rellena cada {{n}} de la plantilla.
 *
 * Es la pieza que faltaba: hasta ahora todas las variables se enviaban con el
 * nombre del contacto, así que una plantilla de dos o tres variables fallaba
 * en cada envío. Aquí se empareja cada una con un dato, y el ejemplo que se
 * escribe aquí es literalmente el que ve el revisor de Meta.
 */
export function EmparejarVariables({
  variables,
  propias,
  onCambiar,
}: {
  variables: VariableDePlantilla[];
  /** Las variables propias del espacio, con el nombre que les pusieron. */
  propias: VariablePersonalizada[];
  onCambiar: (variables: VariableDePlantilla[]) => void;
}) {
  if (variables.length === 0) return null;

  const cambiar = (i: number, cambios: Partial<VariableDePlantilla>) => {
    const copia = [...variables];
    copia[i] = { ...copia[i], ...cambios };
    onCambiar(copia);
  };

  return (
    <div className="rounded-[11px] border border-border bg-surface p-3.5">
      <p className="text-sm font-medium text-foreground">
        ¿Con qué se rellena cada variable?
      </p>
      <p className="mt-0.5 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-muted">
        <Info size={13} className="mt-0.5 shrink-0" />
        Cada {"{{n}}"} del mensaje toma el dato que elijas de cada contacto. El ejemplo es el que ve Meta al
        revisar la plantilla: escribe uno real y la aprueban más rápido.
      </p>

      <div className="mt-3 flex flex-col gap-2.5">
        {variables.map((v, i) => (
          <div key={i} className="flex flex-col gap-1.5 rounded-[9px] border border-border bg-background p-2.5">
            <div className="flex items-center gap-2">
              <span className="shrink-0 rounded-md bg-primary/15 px-1.5 py-0.5 font-mono text-[11px] font-bold text-success">
                {`{{${i + 1}}}`}
              </span>
              <select
                value={v.origen}
                onChange={(e) => cambiar(i, { origen: e.target.value as OrigenVariable })}
                className="min-w-0 flex-1 rounded-[8px] border border-border bg-surface px-2 py-1.5 text-[12.5px] text-foreground outline-none focus:border-primary"
              >
                {ORIGENES.map((o) => (
                  <option key={o} value={o}>
                    {etiquetaDeOrigen(o, propias)}
                  </option>
                ))}
              </select>
            </div>
            <input
              value={v.ejemplo ?? ""}
              onChange={(e) => cambiar(i, { ejemplo: e.target.value })}
              placeholder={v.origen === "nombre" ? "Ejemplo: Felipe" : "Ejemplo: 23 de octubre"}
              className="rounded-[8px] border border-border bg-surface px-2 py-1.5 text-[12.5px] text-foreground outline-none focus:border-primary"
            />
          </div>
        ))}
      </div>

      <p className="mt-2.5 text-[11px] leading-relaxed text-muted">
        Las columnas se llenan desde Contactos o importando el Excel. Si al enviar un contacto no tiene ese
        dato, se le salta y queda anotado el motivo, en vez de mandarle el mensaje incompleto.
      </p>
    </div>
  );
}
