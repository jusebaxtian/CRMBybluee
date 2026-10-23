"use client";

import { Suspense, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, CheckCircle2, Lock, TriangleAlert } from "lucide-react";
import { desconectarGoogleCalendar, guardarLineaDeCitas } from "@/app/actions/integraciones";

export type ConexionGoogle = { cuenta_email: string | null; estado: "conectado" | "requiere_reconexion" } | null;

const MENSAJES: Record<string, { texto: string; bien?: boolean }> = {
  ok: { texto: "Google Calendar conectado.", bien: true },
  cancelado: { texto: "Cancelaste la conexión en Google. No se guardó nada." },
  sin_permiso: {
    texto:
      "Google no nos dio el permiso para crear eventos. Vuelve a conectar y deja marcada la casilla del calendario en la pantalla de permisos.",
  },
  sin_renovacion: {
    texto:
      "Google no entregó el acceso permanente. Quita el acceso de CRM Bybluee en tu cuenta de Google (myaccount.google.com/permissions) y vuelve a conectar.",
  },
  sin_modulo: { texto: "Tu plan no incluye Google Calendar." },
  sin_espacio: { texto: "Tu usuario no pertenece a ningún espacio." },
  sin_configurar: { texto: "La integración todavía no está configurada en el servidor. Avísale al soporte." },
  error: { texto: "No se pudo completar la conexión con Google. Intenta de nuevo." },
};

/**
 * Configuracion -> Integraciones. Una tarjeta por integracion: hoy solo Google
 * Calendar. Para sumar otra basta con agregar su tarjeta aqui.
 */
export type LineaWhatsApp = { id: string; nombre: string };

export function IntegracionesPanel(props: {
  moduloIncluido: boolean;
  google: ConexionGoogle;
  lineas: LineaWhatsApp[];
  lineaDeCitas: string | null;
}) {
  return (
    <Suspense fallback={null}>
      <Contenido {...props} />
    </Suspense>
  );
}

function Contenido({
  moduloIncluido,
  google,
  lineas,
  lineaDeCitas,
}: {
  moduloIncluido: boolean;
  google: ConexionGoogle;
  lineas: LineaWhatsApp[];
  lineaDeCitas: string | null;
}) {
  const router = useRouter();
  const resultado = useSearchParams().get("google");
  const mensaje = resultado ? MENSAJES[resultado] : undefined;
  const [error, setError] = useState<string | null>(null);
  const [trabajando, trabajar] = useTransition();

  const desconectar = () =>
    trabajar(async () => {
      setError(null);
      const r = await desconectarGoogleCalendar();
      if ("error" in r && r.error) {
        setError(r.error);
        return;
      }
      router.replace("/dashboard/settings?tab=integraciones");
      router.refresh();
    });

  const conectado = google?.estado === "conectado";
  const [linea, setLinea] = useState<string>(lineaDeCitas ?? "");
  const [guardado, setGuardado] = useState(false);

  const cambiarLinea = (valor: string) => {
    setLinea(valor);
    setGuardado(false);
    setError(null);
    trabajar(async () => {
      const r = await guardarLineaDeCitas(valor || null);
      if ("error" in r && r.error) {
        setError(r.error);
        setLinea(lineaDeCitas ?? "");
        return;
      }
      setGuardado(true);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {mensaje && (
        <div
          className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
            mensaje.bien ? "border-success/30 bg-success/10 text-success" : "border-warning/30 bg-warning/10 text-foreground"
          }`}
        >
          {mensaje.bien ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <TriangleAlert size={16} className="mt-0.5 shrink-0 text-warning" />}
          {mensaje.texto}
        </div>
      )}

      <div className="rounded-[13px] border border-border bg-surface p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CalendarDays size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-foreground">Google Calendar</h2>
            <p className="mt-1 text-sm text-muted">
              Las citas que crees en la Agenda aparecen en tu Google Calendar, con invitación por correo y link de Meet si lo
              pides. Cada persona conecta su propio calendario.
            </p>

            {!moduloIncluido ? (
              <p className="mt-3 flex items-center gap-1.5 text-sm text-muted">
                <Lock size={14} /> Disponible en planes superiores. Contacta a soporte para activarlo.
              </p>
            ) : conectado ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1.5 text-sm text-success">
                  <CheckCircle2 size={14} /> Conectado{google?.cuenta_email ? ` como ${google.cuenta_email}` : ""}
                </span>
                <button
                  type="button"
                  onClick={desconectar}
                  disabled={trabajando}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-hover disabled:opacity-50"
                >
                  {trabajando ? "Desconectando…" : "Desconectar"}
                </button>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {google?.estado === "requiere_reconexion" && (
                  <span className="flex items-center gap-1.5 text-sm text-warning">
                    <TriangleAlert size={14} /> La conexión venció. Vuelve a conectar.
                  </span>
                )}
                {/* Navegacion completa: el servidor redirige a Google. */}
                <a
                  href="/api/google-calendar/conectar"
                  className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
                >
                  {google ? "Volver a conectar" : "Conectar Google Calendar"}
                </a>
              </div>
            )}
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

            {moduloIncluido && lineas.length > 0 && (
              <div className="mt-4 border-t border-border pt-4">
                <label className="text-sm font-medium text-foreground" htmlFor="linea-de-citas">
                  Línea de WhatsApp para mensajes y recordatorios de citas
                </label>
                <p className="mt-1 text-xs text-muted">
                  Por esta línea sale la confirmación de cada cita al cliente. Si tienes varias, elige la que corresponde para que
                  no salga por otra.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <select
                    id="linea-de-citas"
                    value={linea}
                    disabled={trabajando}
                    onChange={(e) => cambiarLinea(e.target.value)}
                    className="min-w-60 rounded-[9px] border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary disabled:opacity-60"
                  >
                    <option value="">Automática: la línea del chat del contacto</option>
                    {lineas.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.nombre}
                      </option>
                    ))}
                  </select>
                  {guardado && (
                    <span className="flex items-center gap-1 text-xs text-success">
                      <CheckCircle2 size={12} /> Guardado
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
