"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Check, Copy, KeyRound, Lock, Plus, Webhook } from "lucide-react";
import { crearLlaveApi, revocarLlaveApi } from "@/app/actions/api-publica";
import { PERMISOS } from "@/lib/api-publica/permisos";

export type LlaveFila = {
  id: string;
  nombre: string;
  prefijo: string;
  permisos: string[];
  vence_el: string | null;
  revocada_el: string | null;
  ultimo_uso_el: string | null;
  created_at: string;
};

export type UsoApi = { llamadas24h: number; errores24h: number; limitePorMinuto: number };

type Seccion = "llaves" | "webhooks" | "docs";

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" }) : null;

/**
 * Configuración → API e integraciones. Tres secciones: llaves, webhooks y
 * documentación (las dos últimas llegan por `webhooks` y `documentacion`).
 */
export function ApiPanel({
  moduloIncluido,
  llaves,
  uso,
  webhooks,
  documentacion,
}: {
  moduloIncluido: boolean;
  llaves: LlaveFila[];
  uso: UsoApi;
  webhooks?: React.ReactNode;
  documentacion?: React.ReactNode;
}) {
  const [seccion, setSeccion] = useState<Seccion>("llaves");

  if (!moduloIncluido) {
    return (
      <div className="rounded-[13px] border border-border bg-surface p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <KeyRound size={20} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">API e integraciones</h2>
            <p className="mt-1 text-sm text-muted">
              Conecta el CRM con tu facturación, tu ERP, tu tienda en línea o herramientas como Zapier y n8n: envía mensajes, consulta
              contactos y recibe avisos de lo que pasa en tus chats.
            </p>
            <p className="mt-3 flex items-center gap-1.5 text-sm text-muted">
              <Lock size={14} /> Módulo adicional. Contacta a soporte para activarlo.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const boton = (clave: Seccion, texto: string, icono: React.ReactNode) => (
    <button
      type="button"
      onClick={() => setSeccion(clave)}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
        seccion === clave ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface-hover hover:text-foreground"
      }`}
    >
      {icono}
      {texto}
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1">
        {boton("llaves", "Llaves", <KeyRound size={14} />)}
        {webhooks && boton("webhooks", "Webhooks", <Webhook size={14} />)}
        {documentacion && boton("docs", "Documentación", <BookOpen size={14} />)}
      </div>

      <div className={seccion === "llaves" ? "block" : "hidden"}>
        <Llaves llaves={llaves} uso={uso} />
      </div>
      {webhooks && <div className={seccion === "webhooks" ? "block" : "hidden"}>{webhooks}</div>}
      {documentacion && <div className={seccion === "docs" ? "block" : "hidden"}>{documentacion}</div>}
    </div>
  );
}

function Llaves({ llaves, uso }: { llaves: LlaveFila[]; uso: UsoApi }) {
  const router = useRouter();
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [permisos, setPermisos] = useState<string[]>([]);
  const [dias, setDias] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [nueva, setNueva] = useState<string | null>(null);
  const [copiada, setCopiada] = useState(false);
  const [trabajando, trabajar] = useTransition();
  const [ahora] = useState(() => Date.now());

  const activas = llaves.filter((l) => !l.revocada_el);
  const revocadas = llaves.filter((l) => l.revocada_el);

  const alternar = (clave: string) => setPermisos((p) => (p.includes(clave) ? p.filter((x) => x !== clave) : [...p, clave]));

  const crear = () =>
    trabajar(async () => {
      setError(null);
      const r = await crearLlaveApi({ nombre, permisos, venceEnDias: dias ? Number(dias) : null });
      if ("error" in r && r.error) {
        setError(r.error);
        return;
      }
      if ("llave" in r && r.llave) setNueva(r.llave);
      setCreando(false);
      setNombre("");
      setPermisos([]);
      setDias("");
      router.refresh();
    });

  const revocar = (l: LlaveFila) => {
    if (!window.confirm(`¿Revocar la llave «${l.nombre}»? Las aplicaciones que la usen dejarán de funcionar de inmediato.`)) return;
    trabajar(async () => {
      setError(null);
      const r = await revocarLlaveApi(l.id);
      if ("error" in r && r.error) setError(r.error);
      router.refresh();
    });
  };

  const copiar = async () => {
    if (!nueva) return;
    try {
      await navigator.clipboard.writeText(nueva);
      setCopiada(true);
      setTimeout(() => setCopiada(false), 2500);
    } catch {
      // Sin portapapeles: la llave queda visible para copiarla a mano.
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {nueva && (
        <div className="rounded-[13px] border border-warning/40 bg-warning/10 p-4">
          <p className="text-sm font-medium text-foreground">Copia tu llave ahora: no se volverá a mostrar.</p>
          <p className="mt-1 text-xs text-muted">Guárdala en un lugar seguro. Si la pierdes, revoca esta y crea otra.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground">{nueva}</code>
            <button
              type="button"
              onClick={copiar}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-surface-hover"
            >
              {copiada ? <Check size={14} className="text-success" /> : <Copy size={14} />}
              {copiada ? "Copiada" : "Copiar"}
            </button>
          </div>
          <button type="button" onClick={() => setNueva(null)} className="mt-3 text-xs text-muted hover:text-foreground">
            Ya la guardé, cerrar
          </button>
        </div>
      )}

      <div className="rounded-[13px] border border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Llaves de API</h2>
            <p className="mt-1 text-sm text-muted">
              Cada aplicación que conectes usa su propia llave, con solo los permisos que necesite. Límite: {uso.limitePorMinuto} peticiones por
              minuto.
            </p>
          </div>
          {!creando && (
            <button
              type="button"
              onClick={() => setCreando(true)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              <Plus size={14} /> Nueva llave
            </button>
          )}
        </div>

        <p className="mt-3 text-xs text-muted">
          Últimas 24 horas: {uso.llamadas24h} llamadas{uso.errores24h > 0 ? `, ${uso.errores24h} con error` : ""}.
        </p>

        {creando && (
          <div className="mt-4 rounded-lg border border-border p-4">
            <label className="block text-sm font-medium text-foreground">Nombre</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={80}
              placeholder="Ej: Sistema de facturación"
              className="mt-1 w-full rounded-[9px] border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />

            <p className="mt-4 text-sm font-medium text-foreground">Permisos</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {PERMISOS.map((p) => (
                <label key={p.clave} className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-2.5 text-sm hover:bg-surface-hover">
                  <input type="checkbox" checked={permisos.includes(p.clave)} onChange={() => alternar(p.clave)} className="mt-0.5" />
                  <span>
                    <span className="block font-medium text-foreground">{p.titulo}</span>
                    <span className="block text-xs text-muted">{p.detalle}</span>
                  </span>
                </label>
              ))}
            </div>

            <label className="mt-4 block text-sm font-medium text-foreground">Vencimiento</label>
            <select
              value={dias}
              onChange={(e) => setDias(e.target.value)}
              className="mt-1 rounded-[9px] border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            >
              <option value="">No vence</option>
              <option value="30">A los 30 días</option>
              <option value="90">A los 90 días</option>
              <option value="365">Al año</option>
            </select>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={crear}
                disabled={trabajando}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {trabajando ? "Creando…" : "Crear llave"}
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
          {activas.length === 0 && !creando && <p className="text-sm text-muted">Todavía no tienes llaves. Crea la primera para empezar.</p>}
          {activas.map((l) => (
            <FilaLlave key={l.id} l={l} ahora={ahora} onRevocar={() => revocar(l)} deshabilitado={trabajando} />
          ))}
        </div>

        {revocadas.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-xs text-muted">Revocadas ({revocadas.length})</summary>
            <div className="mt-2 flex flex-col gap-2 opacity-70">
              {revocadas.map((l) => (
                <FilaLlave key={l.id} l={l} ahora={ahora} />
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

function FilaLlave({ l, ahora, onRevocar, deshabilitado }: { l: LlaveFila; ahora: number; onRevocar?: () => void; deshabilitado?: boolean }) {
  const vencida = l.vence_el && new Date(l.vence_el).getTime() <= ahora;
  const titulos = new Map<string, string>(PERMISOS.map((p) => [p.clave, p.titulo]));
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">
          {l.nombre} <code className="ml-1 rounded bg-background px-1.5 py-0.5 text-xs text-muted">{l.prefijo}…</code>
          {vencida && !l.revocada_el && <span className="ml-2 text-xs text-warning">Vencida</span>}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {l.permisos.map((p) => (
            <span key={p} className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
              {titulos.get(p) ?? p}
            </span>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted">
          Creada {fecha(l.created_at)} · {l.ultimo_uso_el ? `Último uso ${fecha(l.ultimo_uso_el)}` : "Sin usar"}
          {l.vence_el && !l.revocada_el ? ` · Vence ${fecha(l.vence_el)}` : ""}
          {l.revocada_el ? ` · Revocada ${fecha(l.revocada_el)}` : ""}
        </p>
      </div>
      {onRevocar && (
        <button
          type="button"
          onClick={onRevocar}
          disabled={deshabilitado}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-error hover:bg-surface-hover disabled:opacity-50"
        >
          Revocar
        </button>
      )}
    </div>
  );
}
