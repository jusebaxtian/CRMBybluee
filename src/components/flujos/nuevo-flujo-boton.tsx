"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { crearFlujo } from "@/app/actions/flujos";

/** Crear un flujo es solo ponerle nombre: el resto se dibuja en el lienzo. */
export function NuevoFlujoBoton() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creando, crear] = useTransition();

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex shrink-0 items-center gap-1.5 rounded-[10px] bg-primary px-3.5 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
      >
        <Plus size={15} />
        Nuevo flujo
      </button>
    );
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre del flujo"
          className="w-56 rounded-[9px] border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary"
          onKeyDown={(e) => {
            if (e.key === "Escape") setAbierto(false);
          }}
        />
        <button
          type="button"
          disabled={creando || !nombre.trim()}
          onClick={() =>
            crear(async () => {
              setError(null);
              const r = await crearFlujo(nombre);
              if ("error" in r && r.error) setError(r.error);
              else if ("id" in r) router.push(`/dashboard/flujos/${r.id}`);
            })
          }
          className="rounded-[9px] bg-primary px-3 py-2 text-[13px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {creando ? "Creando…" : "Crear"}
        </button>
        <button type="button" onClick={() => setAbierto(false)} className="text-[13px] text-muted hover:text-foreground">
          Cancelar
        </button>
      </div>
      {error && <span className="text-[11px] text-red-400">{error}</span>}
    </div>
  );
}
