"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cambiarModuloExtra } from "@/app/actions/admin";
import { MODULO_API } from "@/lib/api-publica/permisos";

/**
 * Admin → cliente: habilitar el modulo de API y webhooks solo para este espacio,
 * aunque su plan no lo traiga (0162). Si el plan ya lo incluye, no hace falta.
 */
export function ModuloApiAdmin({
  workspaceId,
  incluidoEnPlan,
  habilitadoAparte,
}: {
  workspaceId: string;
  incluidoEnPlan: boolean;
  habilitadoAparte: boolean;
}) {
  const router = useRouter();
  const [activo, setActivo] = useState(habilitadoAparte);
  const [error, setError] = useState<string | null>(null);
  const [guardando, guardar] = useTransition();

  const cambiar = (valor: boolean) => {
    setActivo(valor);
    setError(null);
    guardar(async () => {
      const r = await cambiarModuloExtra(workspaceId, MODULO_API, valor);
      if ("error" in r && r.error) {
        setError(r.error);
        setActivo(!valor);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="mt-4 border-t border-border pt-4">
      <label className={`flex items-start gap-2.5 ${incluidoEnPlan ? "cursor-default" : "cursor-pointer"}`}>
        <input
          type="checkbox"
          checked={incluidoEnPlan || activo}
          disabled={incluidoEnPlan || guardando}
          onChange={(e) => cambiar(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
        />
        <span>
          <span className="block text-sm font-medium text-foreground">Habilitar módulo de API y webhooks</span>
          <span className="block text-xs text-muted">
            {incluidoEnPlan
              ? "Su plan ya incluye este módulo."
              : "Solo para este cliente, aunque su plan no lo traiga. Le aparece en Configuración → API e integraciones."}
          </span>
        </span>
      </label>
      {guardando && <p className="mt-1 text-xs text-muted">Guardando…</p>}
      {error && <p className="mt-1 text-xs text-error">{error}</p>}
    </div>
  );
}
