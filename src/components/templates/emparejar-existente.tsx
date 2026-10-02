"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, SlidersHorizontal } from "lucide-react";
import { EmparejarVariables } from "@/components/templates/emparejar-variables";
import { guardarEmparejamiento } from "@/app/actions/templates";
import {
  ajustarVariables,
  etiquetaDeOrigen,
  type VariableDePlantilla,
  type VariablePersonalizada,
} from "@/lib/contactos/variables";

/**
 * Arreglar el emparejamiento de una plantilla que ya existe en Meta.
 *
 * El texto de una plantilla aprobada es intocable, pero con qué se rellena
 * cada {{n}} es dato nuestro: se corrige aquí, sin recrearla ni volver a
 * esperar aprobación. Sin esto, las plantillas de dos o más variables que se
 * guardaron sin emparejamiento --todas las anteriores al 1 oct 2026-- solo se
 * podían arreglar borrándolas y creándolas de nuevo con otro nombre, porque
 * Meta reserva el nombre borrado un tiempo.
 */
export function EmparejarExistente({
  templateId,
  variableCount,
  emparejamiento,
  propias,
}: {
  templateId: string;
  variableCount: number;
  emparejamiento: VariableDePlantilla[] | null;
  propias: VariablePersonalizada[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [guardando, guardar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [variables, setVariables] = useState<VariableDePlantilla[]>(
    ajustarVariables(emparejamiento ?? [], variableCount)
  );

  if (variableCount === 0) return null;

  const sinEmparejar = !emparejamiento || emparejamiento.length === 0;

  if (!abierto) {
    return (
      <div className="mt-3">
        {sinEmparejar ? (
          // El aviso solo aparece cuando de verdad rompe el envío. Con una
          // sola variable el comportamiento viejo --rellenarla con el nombre--
          // sigue siendo correcto y no hay nada que arreglar.
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className={`flex w-full items-start gap-1.5 rounded-[9px] border px-2.5 py-2 text-left text-[11px] leading-relaxed ${
              variableCount > 1
                ? "border-red-400/40 bg-red-400/10 text-red-400"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            <span>
              {variableCount > 1
                ? `Esta plantilla tiene ${variableCount} variables sin emparejar: los envíos van a fallar hasta que indiques con qué se rellena cada una.`
                : "Su variable se rellena con el nombre del contacto. Toca para cambiarla."}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className="flex items-center gap-1.5 text-[11px] text-muted hover:text-foreground"
          >
            <SlidersHorizontal size={11} className="shrink-0" />
            {variables
              .map((v, i) => `{{${i + 1}}} ${etiquetaDeOrigen(v.origen, propias).split(" · ").pop()}`)
              .join(" · ")}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3">
      <EmparejarVariables variables={variables} propias={propias} onCambiar={setVariables} />
      {error && <p className="mt-2 text-[11px] text-red-400">{error}</p>}
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          disabled={guardando}
          onClick={() =>
            guardar(async () => {
              setError(null);
              const r = await guardarEmparejamiento(templateId, variables);
              if ("error" in r && r.error) {
                setError(r.error);
                return;
              }
              setListo(true);
              setAbierto(false);
              router.refresh();
            })
          }
          className="rounded-[9px] bg-primary px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="text-[12px] text-muted hover:text-foreground"
        >
          Cancelar
        </button>
        {listo && (
          <span className="flex items-center gap-1 text-[11px] text-success">
            <Check size={11} /> Guardado
          </span>
        )}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-muted">
        El texto de la plantilla ya está aprobado y no cambia: esto solo decide de dónde sale cada dato al
        enviarla, así que no hay que pasar por aprobación otra vez.
      </p>
    </div>
  );
}
