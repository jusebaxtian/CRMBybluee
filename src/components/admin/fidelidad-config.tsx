"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Send } from "lucide-react";
import { enviarEjemploDeFidelidad, guardarConfigFidelidad } from "@/app/actions/fidelidad";
import type { ConfigFidelidad } from "@/lib/fidelidad/envio";

export type EtapaOpcion = { clave: string; titulo: string; categoria: string; plantilla: string };
export type LineaOpcion = { id: string; etiqueta: string };

/** Ajuste del plan de fidelidad: encendido, modo, linea y etapas. */
export function FidelidadConfigPanel({
  inicial,
  lineas,
  etapas,
}: {
  inicial: ConfigFidelidad;
  lineas: LineaOpcion[];
  etapas: EtapaOpcion[];
}) {
  const router = useRouter();
  const [guardando, guardar] = useTransition();
  const [probando, probar] = useTransition();
  const [config, setConfig] = useState<ConfigFidelidad>(inicial);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<string | null>(null);

  const cambiar = (parcial: Partial<ConfigFidelidad>) => setConfig((c) => ({ ...c, ...parcial }));
  const alternarEtapa = (clave: string) =>
    cambiar({
      etapasApagadas: config.etapasApagadas.includes(clave)
        ? config.etapasApagadas.filter((c) => c !== clave)
        : [...config.etapasApagadas, clave],
    });

  const campo =
    "w-full rounded-[9px] border border-border bg-background px-2 py-1.5 text-[13px] text-foreground outline-none focus:border-primary";

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">Ajuste</p>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={config.activo}
            onChange={(e) => cambiar({ activo: e.target.checked })}
            className="h-4 w-4 accent-[var(--color-primary)]"
          />
          Plan de fidelidad encendido
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Línea que envía</label>
          <select value={config.whatsappAccountId} onChange={(e) => cambiar({ whatsappAccountId: e.target.value })} className={campo}>
            <option value="">Sin elegir</option>
            {lineas.map((l) => (
              <option key={l.id} value={l.id}>
                {l.etiqueta}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-muted">Las plantillas están aprobadas en la cuenta de Ventas.</p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Modo</label>
          <select value={config.modo} onChange={(e) => cambiar({ modo: e.target.value as "prueba" | "real" })} className={campo}>
            <option value="prueba">Prueba: todo llega a mi teléfono</option>
            <option value="real">Real: le llega al cliente</option>
          </select>
          {config.modo === "real" && config.activo && (
            <p className="mt-1 text-[11px] font-medium text-error">Los mensajes saldrán a tus clientes de verdad.</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Tope de mensajes por día</label>
          <input
            type="number"
            min={1}
            max={100}
            value={config.topeDiario}
            onChange={(e) => cambiar({ topeDiario: Number(e.target.value) })}
            className={campo}
          />
          <p className="mt-1 text-[11px] text-muted">Salen espaciados unos segundos entre sí, nunca en ráfaga.</p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Mi teléfono de prueba (con código de país)</label>
          <input
            value={config.telefonoPrueba}
            onChange={(e) => cambiar({ telefonoPrueba: e.target.value })}
            placeholder="573001234567"
            className={campo}
          />
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-xs font-medium text-muted">Etapas</p>
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {etapas.map((e) => (
            <li key={e.clave} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
              <label className="flex flex-1 cursor-pointer items-center gap-2 text-foreground">
                <input
                  type="checkbox"
                  checked={!config.etapasApagadas.includes(e.clave)}
                  onChange={() => alternarEtapa(e.clave)}
                  className="h-4 w-4 accent-[var(--color-primary)]"
                />
                {e.titulo}
              </label>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  e.categoria === "MARKETING" ? "bg-warning/15 text-warning" : "bg-primary/10 text-primary"
                }`}
              >
                {e.categoria === "MARKETING" ? "Marketing" : "Utility"}
              </span>
              <button
                type="button"
                disabled={probando}
                onClick={() =>
                  probar(async () => {
                    setError(null);
                    setListo(null);
                    const r = await enviarEjemploDeFidelidad(e.clave);
                    if (r?.error) setError(r.error);
                    else setListo(`Ejemplo de «${e.titulo}» enviado a tu teléfono de prueba.`);
                  })
                }
                className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-surface-hover disabled:opacity-50"
              >
                <Send size={12} />
                Enviarme ejemplo
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          «Enviarme ejemplo» manda la plantilla a tu teléfono de prueba con datos inventados. No toca a ningún cliente.
          Guarda antes de probar si cambiaste la línea o el teléfono.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={guardando}
          onClick={() =>
            guardar(async () => {
              setError(null);
              setListo(null);
              const r = await guardarConfigFidelidad(config);
              if (r?.error) setError(r.error);
              else {
                setListo("Guardado.");
                router.refresh();
              }
            })
          }
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {guardando ? "Guardando..." : "Guardar"}
        </button>
        {listo && (
          <span className="flex items-center gap-1 text-xs text-success">
            <CheckCircle2 size={13} />
            {listo}
          </span>
        )}
        {error && <span className="text-xs text-error">{error}</span>}
      </div>
    </div>
  );
}
