"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircle, Search, Link2, Unlink, Star } from "lucide-react";
import {
  buscarContactosDelAdmin,
  desvincularContactoDeEspacio,
  marcarContactoPrincipal,
  vincularContactoAEspacio,
} from "@/app/actions/admin";

export type ClienteDeEspacio = {
  contact_id: string;
  contact_name: string | null;
  wa_id: string;
  conversation_id: string | null;
  /** manual = vinculado a mano; telefono = coincide con el de registro; adicional = contacto extra (0191). */
  origen: "manual" | "telefono" | "adicional";
  principal: boolean;
};

type Resultado = { id: string; name: string | null; wa_id: string };

const MAXIMO = 5;

/**
 * Tarjeta de Admin → espacio: qué contactos de mi bandeja son de este espacio.
 * Hasta 5 (0191): el principal (el primero, o el que coincide con el teléfono
 * de registro) y otros números del mismo cliente. Desde el chat también se
 * vincula, con "Vincular espacio".
 */
export function ClienteEnMiChat({ workspaceId, contactos }: { workspaceId: string; contactos: ClienteDeEspacio[] }) {
  const router = useRouter();
  const [buscando, setBuscando] = useState(false);
  const [termino, setTermino] = useState("");
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [pendiente, setPendiente] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lleno = contactos.length >= MAXIMO;

  async function buscar(valor: string) {
    setTermino(valor);
    setError(null);
    if (valor.trim().length < 3) {
      setResultados([]);
      return;
    }
    const r = await buscarContactosDelAdmin(valor);
    if ("error" in r && r.error) {
      setError(r.error);
      return;
    }
    setResultados("contactos" in r && r.contactos ? r.contactos : []);
  }

  async function correr(fn: () => Promise<{ error?: string } | { success: true }>) {
    setPendiente(true);
    setError(null);
    const r = await fn();
    setPendiente(false);
    if (r && "error" in r && r.error) {
      setError(r.error);
      return false;
    }
    router.refresh();
    return true;
  }

  async function vincular(contactId: string) {
    const ok = await correr(() => vincularContactoAEspacio(workspaceId, contactId));
    if (ok) {
      setBuscando(false);
      setTermino("");
      setResultados([]);
    }
  }

  return (
    <div className="rounded-[13px] border border-border bg-surface p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          Cliente en mi chat <span className="text-xs font-normal text-muted">· {contactos.length} de {MAXIMO}</span>
        </p>
        {!buscando && !lleno && (
          <button
            type="button"
            onClick={() => setBuscando(true)}
            className="flex items-center gap-1.5 rounded-[9px] border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-hover"
          >
            <Link2 size={13} />
            {contactos.length === 0 ? "Vincular" : "Vincular otro número"}
          </button>
        )}
      </div>

      {contactos.length === 0 && !buscando && (
        <p className="text-xs text-muted">
          Ningún contacto de tu bandeja tiene el número con el que se registró este espacio. Vincúlalo a mano.
        </p>
      )}

      {contactos.length > 0 && (
        <ul className="flex flex-col divide-y divide-border">
          {contactos.map((c) => (
            <li key={c.contact_id} className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                {(c.contact_name ?? c.wa_id).charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
                  <span className="truncate">{c.contact_name ?? c.wa_id}</span>
                  {c.principal && (
                    <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">Principal</span>
                  )}
                </p>
                <p className="text-xs text-muted">
                  {c.wa_id} ·{" "}
                  {c.origen === "telefono" ? "coincide con el número de registro" : c.origen === "manual" ? "vinculado a mano" : "número adicional"}
                </p>
              </div>
              {c.conversation_id && (
                <Link
                  href={`/dashboard/inbox/${c.conversation_id}`}
                  className="flex items-center gap-1.5 rounded-[10px] bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-hover"
                >
                  <MessageCircle size={13} />
                  Abrir chat
                </Link>
              )}
              {!c.principal && (
                <button
                  type="button"
                  disabled={pendiente}
                  onClick={() => void correr(() => marcarContactoPrincipal(workspaceId, c.contact_id))}
                  title="Marcar como principal"
                  className="flex items-center gap-1 rounded-[9px] px-2 py-1.5 text-xs text-muted hover:text-primary disabled:opacity-50"
                >
                  <Star size={13} />
                  Principal
                </button>
              )}
              {c.origen !== "telefono" && (
                <button
                  type="button"
                  disabled={pendiente}
                  onClick={() => void correr(() => desvincularContactoDeEspacio(workspaceId, c.contact_id))}
                  title="Quitar este contacto del espacio"
                  className="flex items-center gap-1 rounded-[9px] px-2 py-1.5 text-xs text-muted hover:text-error disabled:opacity-50"
                >
                  <Unlink size={13} />
                  Quitar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {buscando && (
        <div className="mt-3">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              autoFocus
              value={termino}
              onChange={(e) => void buscar(e.target.value)}
              placeholder="Nombre o número del contacto en tu bandeja"
              className="w-full rounded-[9px] border border-border bg-background py-2 pl-9 pr-3 text-[13px] text-foreground outline-none focus:border-primary"
            />
          </div>
          {resultados.length > 0 && (
            <ul className="mt-2 overflow-hidden rounded-[9px] border border-border">
              {resultados.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    disabled={pendiente}
                    onClick={() => void vincular(r.id)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-surface-hover disabled:opacity-50"
                  >
                    <span className="truncate text-foreground">{r.name ?? "Sin nombre"}</span>
                    <span className="shrink-0 text-xs text-muted">{r.wa_id}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {termino.trim().length >= 3 && resultados.length === 0 && (
            <p className="mt-2 text-xs text-muted">Sin coincidencias en tu bandeja.</p>
          )}
          <button
            type="button"
            onClick={() => {
              setBuscando(false);
              setTermino("");
              setResultados([]);
            }}
            className="mt-2 text-xs text-muted hover:text-foreground"
          >
            Cancelar
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-error">{error}</p>}
    </div>
  );
}
