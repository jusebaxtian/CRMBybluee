"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { MAX_INVITADOS, agregarCorreos } from "@/lib/agenda/correos";

/**
 * Campo de varios correos: cada uno queda como una "etiqueta" con su X. Se agrega al
 * pulsar Enter, coma, espacio o punto y coma, al salir del campo, o al pegar varios de
 * una vez. Un correo mal escrito se avisa en el momento y no se pierde lo ya puesto.
 */
export function CorreosInput({
  valor,
  onChange,
  disabled = false,
  placeholder = "cliente@correo.com",
}: {
  valor: string[];
  onChange: (lista: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [texto, setTexto] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);

  function confirmar(entrada: string) {
    if (!entrada.trim()) {
      setTexto("");
      return;
    }
    const r = agregarCorreos(valor, entrada);
    if (r.lista.length > MAX_INVITADOS) {
      setAviso(`Máximo ${MAX_INVITADOS} invitados.`);
      return;
    }
    onChange(r.lista);
    if (r.rechazado) {
      // Lo malo se deja en el campo para corregirlo; lo bueno ya quedó agregado.
      setTexto(r.rechazado);
      setAviso(`"${r.rechazado}" no es un correo válido.`);
    } else {
      setTexto("");
      setAviso(null);
    }
  }

  return (
    <div>
      <div
        className={`flex flex-wrap items-center gap-1.5 rounded-[9px] border border-border bg-background px-2 py-1.5 focus-within:border-primary ${
          disabled ? "opacity-60" : ""
        }`}
      >
        {valor.map((c) => (
          <span key={c} className="flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 py-0.5 pl-2.5 pr-1 text-xs text-foreground">
            {c}
            {!disabled && (
              <button type="button" aria-label={`Quitar ${c}`} onClick={() => onChange(valor.filter((x) => x !== c))} className="flex h-4 w-4 items-center justify-center rounded-full text-muted hover:bg-primary/20 hover:text-foreground">
                <X size={11} />
              </button>
            )}
          </span>
        ))}
        <input
          type="text"
          inputMode="email"
          value={texto}
          disabled={disabled}
          placeholder={valor.length === 0 ? placeholder : "Agregar otro…"}
          onChange={(e) => {
            const v = e.target.value;
            setAviso(null);
            // Espacio, coma o punto y coma cierran el correo que se estaba escribiendo.
            if (/[\s,;]$/.test(v) && v.trim()) confirmar(v);
            else setTexto(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              confirmar(texto);
            } else if (e.key === "Backspace" && !texto && valor.length > 0) {
              onChange(valor.slice(0, -1));
            }
          }}
          onBlur={() => confirmar(texto)}
          onPaste={(e) => {
            const pegado = e.clipboardData.getData("text");
            if (/[\s,;]/.test(pegado.trim())) {
              e.preventDefault();
              confirmar(pegado);
            }
          }}
          className="min-w-[10rem] flex-1 bg-transparent px-1 py-1 text-[13px] text-foreground outline-none"
        />
      </div>
      {aviso && <p className="mt-1 text-xs text-error">{aviso}</p>}
    </div>
  );
}
