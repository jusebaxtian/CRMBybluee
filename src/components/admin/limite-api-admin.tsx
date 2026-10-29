"use client";

import { useState, useTransition } from "react";
import { guardarLimiteApi } from "@/app/actions/api-publica";

/** Admin → cliente: tope de peticiones por minuto de su API (por defecto 60). */
export function LimiteApiAdmin({ workspaceId, inicial }: { workspaceId: string; inicial: number }) {
  const [valor, setValor] = useState(String(inicial));
  const [mensaje, setMensaje] = useState<{ texto: string; bien: boolean } | null>(null);
  const [guardando, guardar] = useTransition();

  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="text-sm font-medium text-foreground">Límite de la API</p>
      <p className="mt-0.5 text-xs text-muted">Peticiones por minuto de todo el espacio (aplica si tiene el módulo de API, por plan o habilitado arriba).</p>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="number"
          min={1}
          max={6000}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className="w-28 rounded-[9px] border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary"
        />
        <button
          type="button"
          disabled={guardando}
          onClick={() =>
            guardar(async () => {
              const r = await guardarLimiteApi(workspaceId, Number(valor));
              setMensaje("error" in r && r.error ? { texto: r.error, bien: false } : { texto: "Guardado.", bien: true });
            })
          }
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-hover disabled:opacity-50"
        >
          Guardar
        </button>
        {mensaje && <span className={`text-xs ${mensaje.bien ? "text-success" : "text-error"}`}>{mensaje.texto}</span>}
      </div>
    </div>
  );
}
