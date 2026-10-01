"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Columns3, X } from "lucide-react";
import { guardarVariablesPersonalizadas } from "@/app/actions/contacts";
import { INDICES_VARIABLE, type TipoVariable, type VariablePersonalizada } from "@/lib/contactos/variables";

/**
 * Ponerle nombre a las variables 2, 3 y 4.
 *
 * El nombre no es cosmético: con él se busca la columna en el Excel al
 * importar, se titula la plantilla de ejemplo y se nombra la variable al
 * emparejarla con una plantilla de WhatsApp. Una variable sin nombre es una
 * variable que no se usa, y por eso desaparece de la tabla.
 */
export function ConfigurarVariables({ propias }: { propias: VariablePersonalizada[] }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [guardando, guardar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [filas, setFilas] = useState(
    INDICES_VARIABLE.map((indice) => {
      const actual = propias.find((p) => p.indice === indice);
      return { indice, nombre: actual?.nombre ?? "", tipo: (actual?.tipo ?? "texto") as TipoVariable };
    })
  );

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-foreground"
      >
        <Columns3 size={14} />
        Variables
      </button>
    );
  }

  return (
    <div className="absolute right-0 top-12 z-30 w-[330px] rounded-[12px] border border-border bg-surface p-3.5 shadow-lg">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">Tus variables</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
            La {"{{1}}"} siempre es el nombre. Estas son las tuyas: dales un nombre y aparecen como columna,
            en el Excel y al crear plantillas.
          </p>
        </div>
        <button type="button" onClick={() => setAbierto(false)} className="text-muted hover:text-foreground">
          <X size={15} />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {filas.map((f, i) => (
          <div key={f.indice} className="flex items-center gap-1.5">
            <span className="shrink-0 rounded-md bg-primary/15 px-1.5 py-1 font-mono text-[11px] font-bold text-success">
              {`{{${f.indice}}}`}
            </span>
            <input
              value={f.nombre}
              maxLength={40}
              onChange={(e) => {
                const copia = [...filas];
                copia[i] = { ...copia[i], nombre: e.target.value };
                setFilas(copia);
              }}
              placeholder={`Variable ${f.indice}`}
              className="min-w-0 flex-1 rounded-[8px] border border-border bg-background px-2 py-1.5 text-[12.5px] text-foreground outline-none focus:border-primary"
            />
            <select
              value={f.tipo}
              onChange={(e) => {
                const copia = [...filas];
                copia[i] = { ...copia[i], tipo: e.target.value as TipoVariable };
                setFilas(copia);
              }}
              className="shrink-0 rounded-[8px] border border-border bg-background px-1.5 py-1.5 text-[12px] text-foreground outline-none focus:border-primary"
            >
              <option value="texto">Texto</option>
              <option value="numero">Número</option>
              <option value="fecha">Fecha</option>
            </select>
          </div>
        ))}
      </div>

      {error && <p className="mt-2 text-[11px] text-red-400">{error}</p>}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={guardando}
          onClick={() =>
            guardar(async () => {
              setError(null);
              const r = await guardarVariablesPersonalizadas(filas);
              if ("error" in r && r.error) {
                setError(r.error);
                return;
              }
              setAbierto(false);
              router.refresh();
            })
          }
          className="rounded-[9px] bg-primary px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        <span className="text-[11px] text-muted">Dejar el nombre vacío la desactiva.</span>
      </div>
    </div>
  );
}
