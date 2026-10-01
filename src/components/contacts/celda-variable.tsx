"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { guardarVariableDeContacto } from "@/app/actions/contacts";

/**
 * Una variable propia dentro de la tabla: se ve, y con un clic se edita.
 *
 * Sin esto, corregir un dato suelto obligaba a reimportar el Excel entero.
 */
export function CeldaVariable({
  contactId,
  indice,
  valor,
}: {
  contactId: string;
  indice: number;
  valor: string | null;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(valor ?? "");
  const [error, setError] = useState<string | null>(null);
  const [guardando, guardar] = useTransition();

  if (!editando) {
    return (
      <button
        type="button"
        onClick={() => {
          setTexto(valor ?? "");
          setError(null);
          setEditando(true);
        }}
        title="Clic para editar"
        className={`max-w-[160px] truncate rounded px-1 py-0.5 text-left text-[13px] hover:bg-surface-hover ${
          valor ? "text-foreground" : "text-muted"
        }`}
      >
        {valor || "—"}
      </button>
    );
  }

  const confirmar = () =>
    guardar(async () => {
      const r = await guardarVariableDeContacto(contactId, indice, texto);
      if ("error" in r && r.error) {
        setError(r.error);
        return;
      }
      setEditando(false);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-1">
      <input
        autoFocus
        value={texto}
        disabled={guardando}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === "Enter") confirmar();
          if (e.key === "Escape") setEditando(false);
        }}
        className="w-[150px] rounded-[7px] border border-primary bg-background px-1.5 py-1 text-[13px] text-foreground outline-none"
      />
      {error && <span className="max-w-[150px] text-[10.5px] leading-tight text-red-400">{error}</span>}
    </div>
  );
}
