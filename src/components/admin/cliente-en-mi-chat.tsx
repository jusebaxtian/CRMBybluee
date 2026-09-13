"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircle, Search, Link2, Unlink } from "lucide-react";
import { vincularClienteDeEspacio, buscarContactosDelAdmin } from "@/app/actions/admin";

export type ClienteDeEspacio = {
  contact_id: string;
  contact_name: string | null;
  wa_id: string;
  conversation_id: string | null;
  origen: "manual" | "telefono";
};

type Resultado = { id: string; name: string | null; wa_id: string };

/**
 * Tarjeta de Admin → espacio: qué contacto de mi bandeja compró este espacio.
 *
 * El cruce automático se hace por el teléfono que dieron al registrarse; si
 * no coincide (o coincide mal) el administrador lo fija a mano buscando el
 * contacto por nombre o número.
 */
export function ClienteEnMiChat({ workspaceId, cliente }: { workspaceId: string; cliente: ClienteDeEspacio | null }) {
  const router = useRouter();
  const [buscando, setBuscando] = useState(false);
  const [termino, setTermino] = useState("");
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [pendiente, setPendiente] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function fijar(contactId: string | null) {
    setPendiente(true);
    setError(null);
    const r = await vincularClienteDeEspacio(workspaceId, contactId);
    setPendiente(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    setBuscando(false);
    setTermino("");
    setResultados([]);
    router.refresh();
  }

  return (
    <div className="rounded-[13px] border border-border bg-surface p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">Cliente en mi chat</p>
        {!buscando && (
          <button
            type="button"
            onClick={() => setBuscando(true)}
            className="flex items-center gap-1.5 rounded-[9px] border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-hover"
          >
            <Link2 size={13} />
            {cliente ? "Cambiar" : "Vincular"}
          </button>
        )}
      </div>

      {cliente ? (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
            {(cliente.contact_name ?? cliente.wa_id).charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{cliente.contact_name ?? cliente.wa_id}</p>
            <p className="text-xs text-muted">
              {cliente.wa_id} ·{" "}
              {cliente.origen === "manual" ? "vinculado a mano" : "coincide con el número de registro"}
            </p>
          </div>
          {cliente.conversation_id && (
            <Link
              href={`/dashboard/inbox/${cliente.conversation_id}`}
              className="flex items-center gap-1.5 rounded-[10px] bg-primary px-3 py-2 text-xs font-bold text-white hover:bg-primary-hover"
            >
              <MessageCircle size={13} />
              Abrir chat
            </Link>
          )}
          {cliente.origen === "manual" && (
            <button
              type="button"
              disabled={pendiente}
              onClick={() => fijar(null)}
              title="Quitar el vínculo manual"
              className="flex items-center gap-1 rounded-[9px] px-2 py-1.5 text-xs text-muted hover:text-error disabled:opacity-50"
            >
              <Unlink size={13} />
              Quitar
            </button>
          )}
        </div>
      ) : (
        !buscando && (
          <p className="text-xs text-muted">
            Ningún contacto de tu bandeja tiene el número con el que se registró este espacio. Vincúlalo a mano.
          </p>
        )
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
                    onClick={() => fijar(r.id)}
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
