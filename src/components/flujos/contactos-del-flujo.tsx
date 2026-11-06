"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Users, X } from "lucide-react";
import {
  avanzarContactoDelFlujo,
  listarContactosDelFlujo,
  sacarContactosDelFlujo,
  type ContactoEnFlujo,
} from "@/app/actions/flujo-contactos";
import type { OpcionDeAvance } from "@/lib/flujos/gestion";

const fecha = (iso: string) =>
  new Date(iso).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });

const SIN_BLOQUE = "__sin_bloque__";
const CAMPO = "rounded-[9px] border border-border bg-background px-2 py-1.5 text-[13px] text-foreground outline-none focus:border-primary";

type Datos = {
  contactos: ContactoEnFlujo[];
  opcionesPorBloque: Record<string, OpcionDeAvance[]>;
  opcionesSinBloque: OpcionDeAvance[];
  veTodo: boolean;
};

/** Boton del flujo con cuantos contactos tiene dentro, y la ventana para gestionarlos. */
export function ContactosDelFlujo({ flujoId, dentro }: { flujoId: string; dentro: number }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [datos, setDatos] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState<{ error: boolean; texto: string } | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroBloque, setFiltroBloque] = useState("");
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  const [destinos, setDestinos] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    const r = await listarContactosDelFlujo(flujoId);
    setCargando(false);
    if ("error" in r) {
      setAviso({ error: true, texto: r.error });
      return;
    }
    setDatos(r);
    setElegidos(new Set());
  }, [flujoId]);

  useEffect(() => {
    if (!abierto) return;
    const id = setTimeout(() => void cargar(), 0);
    return () => clearTimeout(id);
  }, [abierto, cargar]);

  const contactos = useMemo(() => datos?.contactos ?? [], [datos]);

  const porBloque = useMemo(() => {
    const m = new Map<string, { clave: string; texto: string; n: number }>();
    for (const c of contactos) {
      const clave = c.nodoId ?? SIN_BLOQUE;
      const fila = m.get(clave) ?? { clave, texto: c.bloque, n: 0 };
      fila.n += 1;
      m.set(clave, fila);
    }
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [contactos]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const digitos = q.replace(/\D/g, "");
    return contactos.filter((c) => {
      if (filtroBloque && (c.nodoId ?? SIN_BLOQUE) !== filtroBloque) return false;
      if (!q) return true;
      return (c.nombre ?? "").toLowerCase().includes(q) || (!!digitos && c.waId.includes(digitos));
    });
  }, [contactos, busqueda, filtroBloque]);

  async function sacar(ids: string[]) {
    const texto =
      ids.length === 1
        ? "¿Sacar a este contacto del flujo? No se le envía nada y vuelve a lo normal."
        : `¿Sacar a estos ${ids.length} contactos del flujo? No se les envía nada y vuelven a lo normal.`;
    if (!window.confirm(texto)) return;
    setOcupado(true);
    setAviso(null);
    const r = await sacarContactosDelFlujo(flujoId, ids);
    setOcupado(false);
    if (r.error) {
      setAviso({ error: true, texto: r.error });
    } else {
      const omitidos = r.omitidos ? ` ${r.omitidos} ya no estaban o no son tuyos.` : "";
      setAviso({ error: false, texto: `${r.sacados === 1 ? "Salió 1 contacto" : `Salieron ${r.sacados} contactos`} del flujo.${omitidos}` });
    }
    await cargar();
    router.refresh();
  }

  async function avanzar(c: ContactoEnFlujo, opciones: OpcionDeAvance[]) {
    const destino = destinos[c.ejecucionId];
    const opcion = opciones.find((o) => o.destinoId === destino);
    if (!opcion) {
      setAviso({ error: true, texto: "Elige primero a qué bloque lo mueves." });
      return;
    }
    if (!window.confirm(`¿Mover a ${c.nombre?.trim() || c.waId} a "${opcion.etiqueta}"? Se le enviará de verdad lo que ese bloque mande.`)) return;
    setOcupado(true);
    setAviso(null);
    const r = await avanzarContactoDelFlujo(flujoId, c.ejecucionId, opcion.destinoId);
    setOcupado(false);
    setAviso(r.error ? { error: true, texto: r.error } : { error: false, texto: "Contacto movido." });
    setDestinos((d) => {
      const copia = { ...d };
      delete copia[c.ejecucionId];
      return copia;
    });
    await cargar();
    router.refresh();
  }

  const todosElegidos = visibles.length > 0 && visibles.every((c) => elegidos.has(c.ejecucionId));

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[13px] font-semibold text-foreground hover:bg-surface-hover"
      >
        <Users size={13} />
        {dentro === 1 ? "1 contacto dentro" : `${dentro} contactos dentro`}
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-6">
          <button type="button" aria-label="Cerrar" onClick={() => setAbierto(false)} className="absolute inset-0 bg-black/60" />
          <div role="dialog" aria-modal="true" aria-label="Contactos en este flujo" className="relative flex h-full w-full max-w-4xl flex-col border-border bg-surface md:h-[85vh] md:rounded-[13px] md:border">
            <div className="flex items-start justify-between gap-3 border-b border-border p-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Contactos en este flujo</h2>
                <p className="mt-0.5 text-[11.5px] text-muted">
                  {datos && !datos.veTodo ? "Solo ves los contactos con el chat asignado a ti." : "Mientras están aquí, las automatizaciones, los seguimientos y la IA general no les escriben."}
                </p>
              </div>
              <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar" className="text-muted hover:text-foreground">
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Nombre o número" aria-label="Buscar contacto" className={`min-w-[160px] flex-1 ${CAMPO}`} />
              <select value={filtroBloque} onChange={(e) => setFiltroBloque(e.target.value)} aria-label="Filtrar por bloque" className={`min-w-0 max-w-full flex-1 ${CAMPO}`}>
                <option value="">Todos los bloques ({contactos.length})</option>
                {porBloque.map((b) => (
                  <option key={b.clave} value={b.clave}>
                    {b.n} · {b.texto}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={ocupado || elegidos.size === 0}
                onClick={() => void sacar([...elegidos])}
                className="rounded-[9px] border border-red-400/40 px-3 py-1.5 text-[13px] font-medium text-red-400 hover:bg-red-400/10 disabled:opacity-40"
              >
                Sacar elegidos ({elegidos.size})
              </button>
            </div>

            {aviso && <p className={`px-4 pt-2 text-xs ${aviso.error ? "text-red-400" : "text-success"}`}>{aviso.texto}</p>}

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {cargando && !datos ? (
                <p className="flex items-center justify-center gap-2 p-8 text-sm text-muted">
                  <Loader2 size={15} className="animate-spin" /> Cargando…
                </p>
              ) : visibles.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted">{contactos.length === 0 ? "No hay contactos dentro de este flujo." : "Ningún contacto coincide."}</p>
              ) : (
                <>
                  <label className="mb-2 flex items-center gap-2 px-1 text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={todosElegidos}
                      onChange={(e) => setElegidos(e.target.checked ? new Set(visibles.map((c) => c.ejecucionId)) : new Set())}
                    />
                    Elegir los {visibles.length} que se ven
                  </label>
                  <ul className="flex flex-col gap-2">
                    {visibles.map((c) => {
                      const opciones = (c.nodoId ? datos?.opcionesPorBloque[c.nodoId] : datos?.opcionesSinBloque) ?? [];
                      const siguen = opciones.filter((o) => o.porSalida);
                      const otros = opciones.filter((o) => !o.porSalida);
                      return (
                        <li key={c.ejecucionId} className="rounded-[10px] border border-border p-3">
                          <div className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              aria-label={`Elegir a ${c.nombre?.trim() || c.waId}`}
                              checked={elegidos.has(c.ejecucionId)}
                              onChange={(e) =>
                                setElegidos((s) => {
                                  const copia = new Set(s);
                                  if (e.target.checked) copia.add(c.ejecucionId);
                                  else copia.delete(c.ejecucionId);
                                  return copia;
                                })
                              }
                              className="mt-1"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-semibold text-foreground">{c.nombre?.trim() || "Sin nombre"}</p>
                              <p className="truncate text-xs text-muted">{c.waId}</p>
                              <p className={`mt-1 text-xs ${c.nodoId ? "text-foreground" : "font-medium text-red-400"}`}>{c.bloque}</p>
                              <p className="mt-0.5 text-[11px] text-muted">
                                {c.estado === "esperando" ? "Esperando" : "En curso"} · Entró {fecha(c.entro)} · Vence {fecha(c.vence)}
                              </p>
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2 pl-6">
                            <select
                              value={destinos[c.ejecucionId] ?? ""}
                              onChange={(e) => setDestinos((d) => ({ ...d, [c.ejecucionId]: e.target.value }))}
                              aria-label="Bloque al que se mueve"
                              className={`min-w-0 max-w-full flex-1 ${CAMPO}`}
                            >
                              <option value="">Mover a…</option>
                              {siguen.length > 0 && (
                                <optgroup label="Lo que sigue">
                                  {siguen.map((o) => (
                                    <option key={o.destinoId} value={o.destinoId}>{o.etiqueta}</option>
                                  ))}
                                </optgroup>
                              )}
                              {otros.length > 0 && (
                                <optgroup label="Otro bloque">
                                  {otros.map((o) => (
                                    <option key={o.destinoId} value={o.destinoId}>{o.etiqueta}</option>
                                  ))}
                                </optgroup>
                              )}
                            </select>
                            <button type="button" disabled={ocupado} onClick={() => void avanzar(c, opciones)} className="rounded-[9px] border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-hover disabled:opacity-40">
                              Avanzar
                            </button>
                            <button type="button" disabled={ocupado} onClick={() => void sacar([c.ejecucionId])} className="rounded-[9px] border border-red-400/40 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-400/10 disabled:opacity-40">
                              Sacar
                            </button>
                            {c.conversationId && (
                              <Link href={`/dashboard/inbox/${c.conversationId}`} className="px-1 text-xs text-muted hover:text-foreground">
                                Ir al chat
                              </Link>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
