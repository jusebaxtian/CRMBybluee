"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CalendarDays, ExternalLink, Loader2, Search, Send, TriangleAlert, Video, X } from "lucide-react";
import {
  actualizarEventoAgenda,
  cancelarEventoAgenda,
  consultarDisponibilidad,
  crearEventoAgenda,
  crearPlantillasDeCitaDelEspacio,
  enviarEnlaceDeCita,
  ultimoCorreoDeContacto,
  type EventoAgenda,
} from "@/app/actions/agenda-eventos";
import { buscarContactosParaRecordatorio } from "@/app/actions/recordatorios";
import { INPUT_AGENDA } from "@/components/agenda/formulario-recordatorio";
import { CorreosInput } from "@/components/agenda/correos-input";
import { correoValido } from "@/lib/agenda/tiempo";
import { isoABogotaLocal } from "@/lib/agenda/tiempo";

type Contacto = { id: string; nombre: string; wa_id: string };

const DURACIONES = [
  { min: 15, texto: "15 minutos" },
  { min: 30, texto: "30 minutos" },
  { min: 60, texto: "1 hora" },
  { min: 90, texto: "1 hora 30 min" },
  { min: 120, texto: "2 horas" },
];

/** Valor para <input type="datetime-local"> de una fecha y hora de Bogota. */
function bogotaLocalDe(d: Date): string {
  return isoABogotaLocal(d.toISOString());
}

/**
 * Cita de la Agenda: crea (con contacto, correo del invitado y Meet) o edita /
 * cancela una existente. Las horas son de Bogota. Avisa si ya hay algo en el
 * Google Calendar a esa hora, pero deja guardar igual.
 */
export function FormularioEvento({
  existente,
  fechaInicial,
  correoDeCuenta = null,
  contactoInicial = null,
  onClose,
  onGuardado,
}: {
  existente?: EventoAgenda | null;
  fechaInicial?: Date;
  /** El correo con el que la persona creó su cuenta: va como invitado por defecto en una cita nueva. Si no tiene, queda vacío. */
  correoDeCuenta?: string | null;
  /** Contacto ya elegido (cuando la cita se programa desde su chat). */
  contactoInicial?: { id: string; nombre: string; wa_id?: string } | null;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const [titulo, setTitulo] = useState(existente?.titulo ?? "");
  const [descripcion, setDescripcion] = useState(existente?.descripcion ?? "");
  const [cuando, setCuando] = useState(() =>
    existente ? isoABogotaLocal(existente.inicio) : bogotaLocalDe(fechaInicial ?? new Date(Date.now() + 60 * 60 * 1000))
  );
  const [duracion, setDuracion] = useState(() =>
    existente ? Math.max(5, Math.round((new Date(existente.fin).getTime() - new Date(existente.inicio).getTime()) / 60_000)) : 60
  );
  const [correos, setCorreos] = useState<string[]>(() =>
    existente ? existente.invitados : correoDeCuenta && correoValido(correoDeCuenta) ? [correoDeCuenta.toLowerCase()] : []
  );
  const [conMeet, setConMeet] = useState(existente ? existente.con_meet : true);
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<Contacto[]>([]);
  const [sinResultados, setSinResultados] = useState(false);
  const [contacto, setContacto] = useState<Contacto | null>(contactoInicial ? { id: contactoInicial.id, nombre: contactoInicial.nombre, wa_id: contactoInicial.wa_id ?? "" } : null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [faltaPlantilla, setFaltaPlantilla] = useState(false);
  const [pending, startTransition] = useTransition();
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelada = existente?.estado === "cancelado";

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [onClose]);

  // Desde el chat el contacto ya viene elegido: se suma el correo que se uso con el la ultima vez.
  useEffect(() => {
    if (!contactoInicial) return;
    ultimoCorreoDeContacto(contactoInicial.id).then((e) => {
      if (e && correoValido(e)) setCorreos((actual) => (actual.includes(e.toLowerCase()) ? actual : [...actual, e.toLowerCase()]));
    });
    // Solo al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Aviso de choque: se consulta al cambiar fecha o duracion, con retardo.
  useEffect(() => {
    if (cancelada) return;
    const t = setTimeout(() => {
      consultarDisponibilidad({ inicioLocal: cuando, duracionMin: duracion }).then((r) => setOcupado(r.ocupado));
    }, 500);
    return () => clearTimeout(t);
  }, [cuando, duracion, cancelada]);

  function escribirBusqueda(valor: string) {
    setBusqueda(valor);
    if (temporizador.current) clearTimeout(temporizador.current);
    const q = valor.trim();
    setSinResultados(false);
    if (q.length < 2) {
      setResultados([]);
      return;
    }
    temporizador.current = setTimeout(
      () =>
        buscarContactosParaRecordatorio(q).then((r) => {
          setResultados(r);
          setSinResultados(r.length === 0);
        }),
      250
    );
  }

  function elegirContacto(c: Contacto) {
    setContacto(c);
    setResultados([]);
    // No se vuelve a pedir el correo si ya se uso con este contacto.
    ultimoCorreoDeContacto(c.id).then((e) => {
      // El correo ya usado con este contacto se suma a los invitados, sin repetir.
      if (e && correoValido(e)) setCorreos((actual) => (actual.includes(e.toLowerCase()) ? actual : [...actual, e.toLowerCase()]));
    });
  }

  function guardar() {
    setError(null);
    setAviso(null);
    startTransition(async () => {
      const r = existente
        ? await actualizarEventoAgenda({ id: existente.id, titulo, descripcion, inicioLocal: cuando, duracionMin: duracion, invitadosEmails: correos })
        : contacto
          ? await crearEventoAgenda({ contactId: contacto.id, titulo, descripcion, inicioLocal: cuando, duracionMin: duracion, invitadosEmails: correos, conMeet })
          : { error: "Elige el contacto." };
      if ("error" in r && r.error) {
        setError(r.error);
        return;
      }
      onGuardado();
    });
  }

  function cancelar() {
    if (!existente) return;
    if (!window.confirm("¿Cancelar esta cita? Se borra también de tu Google Calendar y se avisa al invitado.")) return;
    startTransition(async () => {
      const r = await cancelarEventoAgenda(existente.id);
      if ("error" in r && r.error) {
        setError(r.error);
        return;
      }
      onGuardado();
    });
  }

  function enviarEnlace() {
    if (!existente) return;
    setError(null);
    setAviso(null);
    setFaltaPlantilla(false);
    startTransition(async () => {
      const r = await enviarEnlaceDeCita(existente.id);
      if ("error" in r) {
        setError(r.error);
        setFaltaPlantilla(Boolean(r.faltaPlantilla));
      } else setAviso("Enviado por WhatsApp.");
    });
  }

  function crearPlantillas() {
    setError(null);
    startTransition(async () => {
      const r = await crearPlantillasDeCitaDelEspacio();
      if ("error" in r && r.error) {
        setError(r.error);
        return;
      }
      setFaltaPlantilla(false);
      setAviso("Plantillas enviadas a Meta para revisión. Normalmente se aprueban en unos minutos; vuelve a intentar entonces.");
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div className="relative flex max-h-[92vh] w-full flex-col gap-3 overflow-y-auto rounded-t-2xl border border-border bg-surface p-4 shadow-[0_24px_60px_rgba(0,0,0,0.5)] sm:max-w-md sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CalendarDays size={15} className="text-primary" />
            {existente ? `Cita · ${existente.contacto}` : "Nueva cita"}
          </p>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-muted hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        {cancelada && <p className="rounded-[9px] border border-border bg-background px-3 py-2 text-xs text-muted">{existente?.cancelado_desde === "google" ? "Esta cita se canceló desde Google Calendar." : "Esta cita está cancelada."}</p>}

        {!existente && (
          <div>
            <label className="text-xs font-medium text-muted">Contacto</label>
            {contacto ? (
              <div className="mt-1 flex items-center justify-between rounded-[9px] border border-primary/50 bg-primary/10 px-3 py-2 text-sm">
                <span className="min-w-0 truncate text-foreground">
                  {contacto.nombre} {contacto.wa_id && <span className="text-muted">· {contacto.wa_id}</span>}
                </span>
                <button type="button" onClick={() => setContacto(null)} className="text-xs text-muted hover:text-foreground">
                  Cambiar
                </button>
              </div>
            ) : (
              <div className="relative mt-1">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input value={busqueda} onChange={(e) => escribirBusqueda(e.target.value)} placeholder="Buscar por nombre o número…" autoFocus className={`${INPUT_AGENDA} pl-9`} />
                {sinResultados && (
                  <p className="mt-1 text-xs text-muted">No hay ningún contacto con ese nombre o número. Revisa cómo está escrito en Contactos.</p>
                )}
                {resultados.length > 0 && (
                  <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-[9px] border border-border bg-surface shadow-xl">
                    {resultados.map((c) => (
                      <li key={c.id}>
                        <button type="button" onClick={() => elegirContacto(c)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface-hover">
                          <span className="truncate text-foreground">{c.nombre}</span>
                          <span className="ml-2 shrink-0 text-xs text-muted">{c.wa_id}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        <label className="text-xs font-medium text-muted">
          Título
          <input value={titulo} maxLength={200} disabled={cancelada} placeholder="Ej: Demo del CRM" onChange={(e) => setTitulo(e.target.value)} className={`${INPUT_AGENDA} mt-1`} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-medium text-muted">
            Fecha y hora (Bogotá)
            <input type="datetime-local" value={cuando} disabled={cancelada} onChange={(e) => setCuando(e.target.value)} className={`${INPUT_AGENDA} mt-1`} />
          </label>
          <label className="text-xs font-medium text-muted">
            Duración
            <select value={duracion} disabled={cancelada} onChange={(e) => setDuracion(Number(e.target.value))} className={`${INPUT_AGENDA} mt-1`}>
              {DURACIONES.map((d) => (
                <option key={d.min} value={d.min}>
                  {d.texto}
                </option>
              ))}
              {!DURACIONES.some((d) => d.min === duracion) && <option value={duracion}>{duracion} minutos</option>}
            </select>
          </label>
        </div>

        {ocupado && !cancelada && (
          <p className="flex items-start gap-2 rounded-[9px] border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
            <TriangleAlert size={14} className="mt-0.5 shrink-0 text-warning" />
            Ya tienes algo en tu Google Calendar a esa hora. Puedes guardar la cita igual.
          </p>
        )}

        <div className="text-xs font-medium text-muted">
          Invitados por correo (opcional)
          <div className="mt-1">
            <CorreosInput valor={correos} onChange={setCorreos} disabled={cancelada} />
          </div>
          <span className="mt-1 block text-[11px] font-normal">
            Google envía la invitación a cada correo, con el link de Meet si lo pides. Escribe uno y pulsa Enter o coma para agregar otro.
            {!existente && correoDeCuenta && correos.includes(correoDeCuenta.toLowerCase()) ? " Va tu correo de cuenta por defecto; quítalo si no lo necesitas." : ""}
          </span>
        </div>

        {!existente ? (
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={conMeet} onChange={(e) => setConMeet(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
            <Video size={14} className="text-muted" /> Crear reunión de Google Meet
          </label>
        ) : existente.meet_url ? (
          <a href={existente.meet_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-[9px] border border-border bg-background px-3 py-2 text-sm text-primary hover:underline">
            <Video size={14} /> Abrir reunión de Meet <ExternalLink size={12} />
          </a>
        ) : null}

        <label className="text-xs font-medium text-muted">
          Notas (opcional)
          <textarea value={descripcion} disabled={cancelada} maxLength={2000} rows={2} onChange={(e) => setDescripcion(e.target.value)} className={`${INPUT_AGENDA} mt-1 resize-none`} />
        </label>

        {!existente && !contacto && !cancelada && (
          <p className="text-xs text-muted">Escribe el nombre o número y elige al contacto de la lista para poder programar la cita.</p>
        )}
        {error && <p className="text-xs text-error">{error}</p>}
        {faltaPlantilla && (
          <button type="button" onClick={crearPlantillas} disabled={pending} className="rounded-[9px] border border-primary px-3 py-2 text-xs text-primary hover:bg-primary/10 disabled:opacity-50">
            Crear plantillas de confirmación de citas
          </button>
        )}
        {aviso && <p className="text-xs text-success">{aviso}</p>}

        {!cancelada && (
          <div className="flex items-center gap-2">
            {existente && (
              <button type="button" onClick={cancelar} disabled={pending} className="rounded-[9px] border border-border px-3 py-2 text-xs text-muted hover:border-error hover:text-error disabled:opacity-50">
                Cancelar cita
              </button>
            )}
            <button
              type="button"
              onClick={guardar}
              disabled={pending || !titulo.trim() || (!existente && !contacto)}
              className="flex flex-1 items-center justify-center gap-2 rounded-[9px] bg-primary px-3 py-2 text-sm font-bold text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {pending && <Loader2 size={14} className="animate-spin" />}
              {existente ? "Guardar cambios" : "Programar cita"}
            </button>
          </div>
        )}

        {existente && !cancelada && (
          <div className="flex flex-col gap-1.5 text-center text-xs">
            <button type="button" onClick={enviarEnlace} disabled={pending} className="flex items-center justify-center gap-1.5 text-primary hover:underline disabled:opacity-50">
              <Send size={12} /> Enviar detalle y link por WhatsApp
            </button>
            {existente.conversation_id && (
              <a href={`/dashboard/inbox/${existente.conversation_id}`} className="text-primary hover:underline">
                Ir al chat de {existente.contacto}
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
