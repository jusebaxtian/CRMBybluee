"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { CalendarPlus, X } from "lucide-react";
import { estadoDeAgendaDelUsuario } from "@/app/actions/agenda-eventos";
import { FormularioEvento } from "@/components/agenda/formulario-evento";

type Estado = { listo: boolean; moduloIncluido: boolean; requiereReconexion: boolean; correo: string | null; modoSoporte: boolean };

/**
 * Botón del chat para programar una CITA (Google Calendar + Meet) con este contacto,
 * con el mismo formulario de la Agenda y el contacto ya elegido. La cita aparece en la
 * Agenda como cualquier otra. El recordatorio (aviso en la campana) sigue en su botón.
 */
export function CitaPicker({ contactId, contactName }: { contactId: string; contactName: string }) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [formulario, setFormulario] = useState(false);
  const [aviso, setAviso] = useState(false);
  const [cargando, cargar] = useTransition();
  const [guardada, setGuardada] = useState(false);

  function abrir() {
    setGuardada(false);
    cargar(async () => {
      // El estado se pide al abrir (no al montar el chat): una consulta solo cuando se usa.
      const e = estado ?? (await estadoDeAgendaDelUsuario());
      setEstado(e);
      if (e.listo) setFormulario(true);
      else setAviso(true);
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={abrir}
        disabled={cargando}
        title="Nueva cita (Google Calendar y Meet)"
        aria-label="Nueva cita"
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          formulario || aviso ? "bg-primary text-white" : "text-muted hover:bg-surface-hover hover:text-foreground"
        } disabled:opacity-60`}
      >
        <CalendarPlus size={18} />
      </button>

      {guardada && (
        <p className="absolute left-full top-1/2 z-20 ml-2 -translate-y-1/2 whitespace-nowrap rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-success shadow-xl">
          Cita programada. La ves en la Agenda.
        </p>
      )}

      {aviso && estado && (
        <div className="absolute left-full top-1/2 z-20 ml-2 w-64 -translate-y-1/2 rounded-[13px] border border-border bg-surface p-3 text-xs shadow-xl">
          <div className="mb-1 flex items-center justify-between">
            <p className="font-medium text-foreground">Nueva cita</p>
            <button type="button" onClick={() => setAviso(false)} aria-label="Cerrar" className="text-muted hover:text-foreground">
              <X size={14} />
            </button>
          </div>
          {estado.modoSoporte ? (
            <p className="text-muted">Modo soporte: las citas se programan desde la cuenta del cliente, porque se crearían en tu propio Google Calendar.</p>
          ) : !estado.moduloIncluido ? (
            <p className="text-muted">Tu plan no incluye Google Calendar. Contacta a soporte para activarlo.</p>
          ) : (
            <p className="text-muted">
              {estado.requiereReconexion ? "Tu conexión con Google venció. " : "Conecta tu Google Calendar para programar citas. "}
              <Link href="/dashboard/settings?tab=integraciones" className="text-primary hover:underline">
                Ir a Integraciones
              </Link>
            </p>
          )}
        </div>
      )}

      {/* En un portal: el grupo de botones del chat esta centrado con una transformacion, y eso
          haria que el modal (position: fixed) se calculara respecto al grupo y no a la pantalla. */}
      {formulario &&
        estado &&
        createPortal(
          <FormularioEvento
            contactoInicial={{ id: contactId, nombre: contactName }}
            correoDeCuenta={estado.correo}
            onClose={() => setFormulario(false)}
            onGuardado={() => {
              setFormulario(false);
              setGuardada(true);
              setTimeout(() => setGuardada(false), 4000);
            }}
          />,
          document.body
        )}
    </div>
  );
}
