"use client";

import { useState } from "react";
import { BellOff, BellRing, Download, Share, Smartphone } from "lucide-react";
import { etiquetaDelBoton } from "@/lib/push/estado";
import { useNotificaciones, type ResultadoPrueba } from "@/components/notifications/usar-notificaciones";

/**
 * Boton visible en la barra superior (lo ven todos los roles) para activar, probar
 * y arreglar las notificaciones del celular. Si no estan activas es una pastilla
 * ambar que llama la atencion; si lo estan, un icono discreto con un punto verde.
 */
export function CentroDeNotificaciones() {
  const { estado, puedeInstalar, trabajando, activar, probar, instalar, reevaluar } = useNotificaciones();
  const [abierto, setAbierto] = useState(false);
  const [prueba, setPrueba] = useState<ResultadoPrueba | null>(null);

  if (estado === "cargando") return null;

  const activas = estado === "activas";
  const Icono = activas ? BellRing : estado === "bloqueadas" ? BellOff : estado === "ios-instalar" ? Smartphone : BellRing;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setAbierto((a) => !a);
          setPrueba(null);
          void reevaluar();
        }}
        aria-label={etiquetaDelBoton(estado)}
        title={etiquetaDelBoton(estado)}
        className={
          activas
            ? "relative flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted hover:text-foreground"
            : "flex h-9 items-center gap-1.5 rounded-lg border border-warning/60 bg-warning/10 px-2.5 text-[12.5px] font-semibold text-warning hover:bg-warning/20"
        }
      >
        <Icono size={16} />
        {activas ? (
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-success" />
        ) : (
          <span>{etiquetaDelBoton(estado)}</span>
        )}
      </button>

      {abierto && (
        <>
          <button type="button" aria-label="Cerrar" className="fixed inset-0 z-10 cursor-default" onClick={() => setAbierto(false)} />
          <div className="fixed inset-x-3 top-14 z-20 max-h-[80vh] overflow-y-auto rounded-xl border border-border bg-surface p-4 shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80">
            {estado === "por-activar" && (
              <>
                <p className="text-sm font-semibold text-foreground">Activa las notificaciones</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Entérate al instante de cada mensaje nuevo, aunque la app esté cerrada o el celular bloqueado. Verás quién te escribe y lo que dice, como en cualquier app de mensajes.
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await activar();
                    if (ok) setPrueba({ ok: true, mensaje: "¡Listo! Ya recibirás los mensajes nuevos." });
                  }}
                  disabled={trabajando}
                  className="mt-3 w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
                >
                  {trabajando ? "Activando…" : "Activar notificaciones"}
                </button>
              </>
            )}

            {estado === "activas" && (
              <>
                <p className="flex items-center gap-1.5 text-sm font-semibold text-success">
                  <span className="h-2 w-2 rounded-full bg-success" /> Notificaciones activas
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Recibes los mensajes nuevos en este dispositivo, aunque tengas la app cerrada. Si no suenan, revisa en los ajustes del teléfono que las notificaciones de ByBluee (o del navegador) tengan sonido.
                </p>
                <button
                  type="button"
                  onClick={async () => setPrueba(await probar())}
                  disabled={trabajando}
                  className="mt-3 w-full rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-hover disabled:opacity-50"
                >
                  {trabajando ? "Enviando…" : "Enviarme una notificación de prueba"}
                </button>
              </>
            )}

            {estado === "bloqueadas" && (
              <>
                <p className="text-sm font-semibold text-error">Las notificaciones están bloqueadas</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">Hay que permitirlas a mano, la página no puede hacerlo por ti:</p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted">
                  <li>
                    <b className="text-foreground">Android (Chrome):</b> toca el candado junto a la dirección → Permisos → Notificaciones → Permitir. Si instalaste la app: Ajustes del teléfono → Apps → ByBluee → Notificaciones.
                  </li>
                  <li>
                    <b className="text-foreground">iPhone:</b> Ajustes → Notificaciones → ByBluee → Permitir.
                  </li>
                  <li>
                    <b className="text-foreground">Computador:</b> clic en el candado junto a la dirección → Notificaciones → Permitir.
                  </li>
                </ul>
                <button
                  type="button"
                  onClick={() => void reevaluar()}
                  className="mt-3 w-full rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-hover"
                >
                  Ya las permití, revisar de nuevo
                </button>
              </>
            )}

            {estado === "ios-instalar" && (
              <>
                <p className="text-sm font-semibold text-foreground">Instala la app en tu iPhone</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  En iPhone las notificaciones solo funcionan con la app en la pantalla de inicio:
                </p>
                <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-muted">
                  <li>
                    En Safari toca <Share size={12} className="inline -translate-y-0.5" /> <b className="text-foreground">Compartir</b>.
                  </li>
                  <li>
                    Elige <b className="text-foreground">Añadir a pantalla de inicio</b>.
                  </li>
                  <li>Abre ByBluee desde ese ícono y toca «Activar avisos».</li>
                </ol>
              </>
            )}

            {estado === "no-soportado" && (
              <>
                <p className="text-sm font-semibold text-foreground">Este navegador no admite notificaciones</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Abre ByBluee en Chrome, Edge o Firefox (en iPhone, instálala desde Safari en la pantalla de inicio).
                </p>
              </>
            )}

            {puedeInstalar && estado !== "ios-instalar" && (
              <button
                type="button"
                onClick={() => void instalar()}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary/50 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10"
              >
                <Download size={14} /> Instalar la app en este celular
              </button>
            )}

            {prueba && <p className={`mt-3 text-xs ${prueba.ok ? "text-success" : "text-error"}`}>{prueba.mensaje}</p>}
          </div>
        </>
      )}
    </div>
  );
}
