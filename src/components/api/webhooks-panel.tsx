"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Plus, Send } from "lucide-react";
import { alternarWebhook, crearWebhook, eliminarWebhook, enviarPruebaWebhook, reintentarEnvioWebhook } from "@/app/actions/api-publica";
import { EVENTOS } from "@/lib/api-publica/eventos";

export type WebhookFila = {
  id: string;
  nombre: string;
  url: string;
  eventos: string[];
  activo: boolean;
  desactivado_motivo: string | null;
  ultimo_envio_el: string | null;
};

export type EnvioFila = {
  id: string;
  webhook_id: string;
  evento: string;
  estado: "pendiente" | "enviado" | "fallido";
  intentos: number;
  ultimo_codigo: number | null;
  ultimo_error: string | null;
  creado_el: string;
};

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "short", timeStyle: "medium" }) : "—";

const COLOR_ESTADO = { pendiente: "text-warning", enviado: "text-success", fallido: "text-error" } as const;
const TEXTO_ESTADO = { pendiente: "Pendiente", enviado: "Entregado", fallido: "Fallido" } as const;

/** Configuración → API → Webhooks: avisos a una URL tuya cuando pasa algo en el CRM. */
export function WebhooksPanel({ webhooks, envios }: { webhooks: WebhookFila[]; envios: EnvioFila[] }) {
  const router = useRouter();
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [url, setUrl] = useState("");
  const [eventos, setEventos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [secreto, setSecreto] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [prueba, setPrueba] = useState<{ id: string; texto: string; bien: boolean } | null>(null);
  const [trabajando, trabajar] = useTransition();

  const alternar = (clave: string) => setEventos((p) => (p.includes(clave) ? p.filter((x) => x !== clave) : [...p, clave]));

  const crear = () =>
    trabajar(async () => {
      setError(null);
      const r = await crearWebhook({ nombre, url, eventos });
      if ("error" in r && r.error) {
        setError(r.error);
        return;
      }
      if ("secreto" in r && r.secreto) setSecreto(r.secreto);
      setCreando(false);
      setNombre("");
      setUrl("");
      setEventos([]);
      router.refresh();
    });

  const accion = (fn: () => Promise<{ error?: string }>) =>
    trabajar(async () => {
      setError(null);
      const r = await fn();
      if (r.error) setError(r.error);
      router.refresh();
    });

  const probar = (w: WebhookFila) =>
    trabajar(async () => {
      setError(null);
      setPrueba(null);
      const r = await enviarPruebaWebhook(w.id);
      if ("error" in r && r.error) {
        setError(r.error);
        return;
      }
      if ("ok" in r)
        setPrueba({
          id: w.id,
          bien: r.ok === true,
          texto: r.ok ? `Tu servidor respondió ${r.codigo}. Todo bien.` : (r.mensaje ?? "No respondió correctamente."),
        });
      router.refresh();
    });

  const copiar = async () => {
    if (!secreto) return;
    try {
      await navigator.clipboard.writeText(secreto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sin portapapeles: el secreto queda visible para copiarlo a mano.
    }
  };

  const nombreDe = new Map(webhooks.map((w) => [w.id, w.nombre]));

  return (
    <div className="flex flex-col gap-4">
      {secreto && (
        <div className="rounded-[13px] border border-warning/40 bg-warning/10 p-4">
          <p className="text-sm font-medium text-foreground">Copia el secreto de firma ahora: no se volverá a mostrar.</p>
          <p className="mt-1 text-xs text-muted">Con él tu servidor comprueba que cada aviso viene de Bybluee CRM (mira «Documentación»).</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground">{secreto}</code>
            <button type="button" onClick={copiar} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-surface-hover">
              {copiado ? <Check size={14} className="text-success" /> : <Copy size={14} />}
              {copiado ? "Copiado" : "Copiar"}
            </button>
          </div>
          <button type="button" onClick={() => setSecreto(null)} className="mt-3 text-xs text-muted hover:text-foreground">
            Ya lo guardé, cerrar
          </button>
        </div>
      )}

      <div className="rounded-[13px] border border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Webhooks</h2>
            <p className="mt-1 text-sm text-muted">
              Bybluee CRM llama a la URL que indiques cuando pasa algo: llega un mensaje, se entrega, se crea un contacto… Si tu servidor
              falla, reintenta varias veces.
            </p>
          </div>
          {!creando && (
            <button type="button" onClick={() => setCreando(true)} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90">
              <Plus size={14} /> Nuevo webhook
            </button>
          )}
        </div>

        {creando && (
          <div className="mt-4 rounded-lg border border-border p-4">
            <label className="block text-sm font-medium text-foreground">Nombre</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={80}
              placeholder="Ej: Mi ERP"
              className="mt-1 w-full rounded-[9px] border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
            <label className="mt-3 block text-sm font-medium text-foreground">URL</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://mi-servidor.com/webhooks/bybluee"
              className="mt-1 w-full rounded-[9px] border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
            <p className="mt-4 text-sm font-medium text-foreground">Eventos</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {EVENTOS.map((e) => (
                <label key={e.clave} className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-2.5 text-sm hover:bg-surface-hover">
                  <input type="checkbox" checked={eventos.includes(e.clave)} onChange={() => alternar(e.clave)} className="mt-0.5" />
                  <span>
                    <span className="block font-medium text-foreground">{e.titulo}</span>
                    <span className="block text-xs text-muted">{e.detalle}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={crear} disabled={trabajando} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
                {trabajando ? "Creando…" : "Crear webhook"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreando(false);
                  setError(null);
                }}
                className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-surface-hover"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-error">{error}</p>}

        <div className="mt-4 flex flex-col gap-2">
          {webhooks.length === 0 && !creando && <p className="text-sm text-muted">Todavía no tienes webhooks.</p>}
          {webhooks.map((w) => (
            <div key={w.id} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {w.nombre}
                    <span className={`ml-2 text-xs ${w.activo ? "text-success" : "text-warning"}`}>{w.activo ? "Activo" : "Pausado"}</span>
                  </p>
                  <p className="mt-0.5 break-all text-xs text-muted">{w.url}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {w.eventos.map((e) => (
                      <span key={e} className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                        {e}
                      </span>
                    ))}
                  </div>
                  {!w.activo && w.desactivado_motivo && <p className="mt-1.5 text-xs text-warning">{w.desactivado_motivo}</p>}
                  <p className="mt-1.5 text-xs text-muted">Último aviso entregado: {fecha(w.ultimo_envio_el)}</p>
                  {prueba?.id === w.id && <p className={`mt-1.5 text-xs ${prueba.bien ? "text-success" : "text-error"}`}>{prueba.texto}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={trabajando} onClick={() => probar(w)} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-hover disabled:opacity-50">
                    <Send size={13} /> Probar
                  </button>
                  <button type="button" disabled={trabajando} onClick={() => accion(() => alternarWebhook(w.id, !w.activo))} className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-hover disabled:opacity-50">
                    {w.activo ? "Pausar" : "Activar"}
                  </button>
                  <button
                    type="button"
                    disabled={trabajando}
                    onClick={() => {
                      if (window.confirm(`¿Eliminar el webhook «${w.nombre}»?`)) accion(() => eliminarWebhook(w.id));
                    }}
                    className="rounded-lg border border-border px-3 py-1.5 text-sm text-error hover:bg-surface-hover disabled:opacity-50"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[13px] border border-border bg-surface p-5">
        <h3 className="text-sm font-semibold text-foreground">Últimos avisos</h3>
        {envios.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Aquí verás los últimos avisos enviados y si tu servidor los recibió.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-muted">
                <tr>
                  <th className="py-1.5 pr-3 font-medium">Fecha</th>
                  <th className="py-1.5 pr-3 font-medium">Webhook</th>
                  <th className="py-1.5 pr-3 font-medium">Evento</th>
                  <th className="py-1.5 pr-3 font-medium">Estado</th>
                  <th className="py-1.5 font-medium" />
                </tr>
              </thead>
              <tbody>
                {envios.map((e) => (
                  <tr key={e.id} className="border-t border-border align-top">
                    <td className="whitespace-nowrap py-1.5 pr-3 text-muted">{fecha(e.creado_el)}</td>
                    <td className="py-1.5 pr-3 text-foreground">{nombreDe.get(e.webhook_id) ?? "—"}</td>
                    <td className="py-1.5 pr-3 text-foreground">{e.evento}</td>
                    <td className="py-1.5 pr-3">
                      <span className={COLOR_ESTADO[e.estado]}>{TEXTO_ESTADO[e.estado]}</span>
                      {e.ultimo_codigo ? <span className="text-muted"> · {e.ultimo_codigo}</span> : null}
                      {e.estado !== "enviado" && e.ultimo_error ? <span className="block text-muted">{e.ultimo_error}</span> : null}
                      {e.estado === "pendiente" && e.intentos > 0 ? <span className="block text-muted">Intento {e.intentos}, se reintentará</span> : null}
                    </td>
                    <td className="py-1.5 text-right">
                      {e.estado === "fallido" && e.evento !== "prueba.ping" && (
                        <button type="button" disabled={trabajando} onClick={() => accion(() => reintentarEnvioWebhook(e.id))} className="text-primary hover:underline disabled:opacity-50">
                          Reintentar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
