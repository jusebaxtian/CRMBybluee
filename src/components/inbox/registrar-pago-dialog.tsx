"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeDollarSign, Check, Copy, Loader2, X } from "lucide-react";
import { contextoPagoDesdeChat, registrarPagoDesdeChat, type ContextoPago } from "@/app/actions/pagos-chat";

const INPUT =
  "w-full rounded-[9px] border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary disabled:opacity-50";

function formatoCop(cents: number, currency: string) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: currency || "COP", maximumFractionDigits: 0 }).format(cents / 100);
}

/**
 * "Registrar pago" desde un comprobante recibido en el chat de soporte.
 * Si el contacto ya tiene espacio, lo activa con el plan pagado; si no,
 * genera un enlace de registro con el pago ya enlazado, para copiar y enviar.
 */
export function RegistrarPagoDialog({
  messageId,
  contactId,
  preview,
  modoInicial = "pago",
  onClose,
}: {
  /** Comprobante recibido en el chat (con adjunto), o... */
  messageId?: string;
  /** ...directamente el contacto (sin comprobante), p. ej. para una demo. */
  contactId?: string;
  preview?: string;
  modoInicial?: "pago" | "demo";
  onClose: () => void;
}) {
  const router = useRouter();
  const [ctx, setCtx] = useState<ContextoPago | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [planId, setPlanId] = useState("");
  const [monto, setMonto] = useState("");
  const [nota, setNota] = useState("");
  const [venceEl, setVenceEl] = useState("");
  const [modo, setModo] = useState<"pago" | "demo">(modoInicial);
  const [diasDemo, setDiasDemo] = useState("2");
  const [destino, setDestino] = useState<"espacio" | "invitacion">("espacio");
  const [resultado, setResultado] = useState<{ tipo: "activado"; espacio: string } | { tipo: "invitacion"; enlace: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [guardando, startGuardar] = useTransition();

  useEffect(() => {
    let vivo = true;
    contextoPagoDesdeChat({ messageId, contactId }).then((r) => {
      if (!vivo) return;
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setCtx(r);
      const primero = r.planes[0];
      if (primero) {
        setPlanId(primero.id);
        setMonto(String(primero.price_cents / 100));
      }
      setDestino(r.espacio ? "espacio" : "invitacion");
    });
    return () => {
      vivo = false;
    };
  }, [messageId, contactId]);

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [onClose]);

  function elegirPlan(id: string) {
    setPlanId(id);
    const p = ctx?.planes.find((x) => x.id === id);
    if (p) setMonto(String(p.price_cents / 100));
  }

  function guardar() {
    setError(null);
    startGuardar(async () => {
      const r = await registrarPagoDesdeChat({
        messageId,
        contactId,
        workspaceId: destino === "espacio" && ctx?.espacio ? ctx.espacio.id : null,
        planId,
        modo,
        amount: monto,
        diasDemo: Number(diasDemo),
        nota,
        venceEl,
      });
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setResultado(r);
      router.refresh();
    });
  }

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div className="relative flex max-h-[90vh] w-full flex-col overflow-y-auto rounded-t-2xl border border-border bg-surface p-4 shadow-[0_24px_60px_rgba(0,0,0,0.5)] animate-[reveal-up_0.2s_ease-out] sm:max-w-md sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <BadgeDollarSign size={16} className="text-primary" />
            {modo === "demo" ? "Cuenta demo" : "Registrar pago"}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-hover hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        {preview && <p className="mb-3 truncate rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted">{preview}</p>}

        {resultado ? (
          <div className="flex flex-col gap-3">
            {resultado.tipo === "activado" ? (
              <div className="rounded-[12px] border border-primary/30 bg-primary/10 p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Check size={16} className="text-success" /> Pago registrado
                </p>
                <p className="mt-1 text-xs text-muted">
                  <strong className="text-foreground">{resultado.espacio}</strong>{" "}
                  {modo === "demo"
                    ? `quedó activo en demo por ${diasDemo} días con el plan elegido.`
                    : "quedó activo con el plan elegido, con su renovación calculada y el comprobante guardado en su historial de pagos."}
                </p>
              </div>
            ) : (
              <div className="rounded-[12px] border border-primary/30 bg-primary/10 p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Check size={16} className="text-success" />{" "}
                  {modo === "demo" ? "Enlace demo listo. Envíale este enlace:" : "Pago guardado. Envíale este enlace:"}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {modo === "demo"
                    ? `Al registrarse con él, su cuenta nace activa por ${diasDemo} días con el plan elegido, sin pago.`
                    : "Al registrarse con él, su cuenta nace activa con el plan pagado y el comprobante enlazado."}
                </p>
                <button
                  type="button"
                  onClick={() => copiar(resultado.enlace)}
                  title="Clic para copiar"
                  className="mt-2 flex w-full items-center gap-2 rounded-[9px] border border-border bg-background px-3 py-2 text-left text-xs text-foreground hover:border-primary"
                >
                  <span className="min-w-0 flex-1 truncate font-mono">{resultado.enlace}</span>
                  {copiado ? <Check size={14} className="shrink-0 text-success" /> : <Copy size={14} className="shrink-0 text-muted" />}
                </button>
                <p className="mt-1 text-[11px] text-muted">{copiado ? "Enlace copiado ✓" : "Toca el enlace para copiarlo."}</p>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-[10px] bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-hover"
            >
              Listo
            </button>
          </div>
        ) : !ctx ? (
          error ? (
            <p className="text-sm text-error">{error}</p>
          ) : (
            <p className="flex items-center gap-2 py-4 text-sm text-muted">
              <Loader2 size={15} className="animate-spin" /> Cargando…
            </p>
          )
        ) : (
          <div className="flex flex-col gap-3">
            <div className="rounded-[10px] border border-border bg-background px-3 py-2 text-xs">
              <p className="font-semibold text-foreground">{ctx.contacto.nombre}</p>
              <p className="text-muted">{ctx.contacto.wa_id}</p>
            </div>

            <div className="grid grid-cols-2 gap-1 rounded-[10px] border border-border p-1 text-xs">
              {(["pago", "demo"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModo(m)}
                  className={`rounded-[8px] px-2 py-1.5 font-semibold ${modo === m ? "bg-primary text-white" : "text-muted hover:text-foreground"}`}
                >
                  {m === "pago" ? "Con pago" : "Demo sin pago"}
                </button>
              ))}
            </div>

            {ctx.espacio ? (
              <div className="flex flex-col gap-1.5">
                <label className="flex cursor-pointer items-start gap-2 rounded-[10px] border border-border p-2.5 text-xs has-[:checked]:border-primary">
                  <input type="radio" name="destino" checked={destino === "espacio"} onChange={() => setDestino("espacio")} className="mt-0.5" />
                  <span>
                    <span className="block font-semibold text-foreground">Aplicar a su espacio: {ctx.espacio.nombre}</span>
                    <span className="text-muted">
                      Hoy: {ctx.espacio.plan ?? "sin plan"}
                      {ctx.espacio.vence ? ` · vence ${new Date(ctx.espacio.vence).toLocaleDateString("es-CO")}` : ""}
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2 rounded-[10px] border border-border p-2.5 text-xs has-[:checked]:border-primary">
                  <input type="radio" name="destino" checked={destino === "invitacion"} onChange={() => setDestino("invitacion")} className="mt-0.5" />
                  <span>
                    <span className="block font-semibold text-foreground">Es para una cuenta nueva</span>
                    <span className="text-muted">Genera un enlace de registro con el pago ya aplicado.</span>
                  </span>
                </label>
              </div>
            ) : (
              <p className="rounded-[10px] border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
                Este contacto aún no tiene cuenta. Se generará un <strong>enlace de registro</strong> para enviarle; al
                registrarse quedará activo {modo === "demo" ? "en demo por los días elegidos" : "con el plan pagado"}.
              </p>
            )}

            <label className="text-xs font-medium text-muted">
              Plan
              <select value={planId} onChange={(e) => elegirPlan(e.target.value)} className={`${INPUT} mt-1`}>
                {ctx.planes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {formatoCop(p.price_cents, p.currency)}
                  </option>
                ))}
              </select>
            </label>
            {modo === "demo" ? (
              <label className="text-xs font-medium text-muted">
                Días de demo
                <input
                  type="number"
                  min={1}
                  max={365}
                  inputMode="numeric"
                  value={diasDemo}
                  onChange={(e) => setDiasDemo(e.target.value)}
                  className={`${INPUT} mt-1`}
                />
                <span className="mt-1 block text-[11px] font-normal text-muted">
                  Sin pago. Al cumplirse los días el espacio pasa a prueba vencida.
                </span>
              </label>
            ) : (
              <label className="text-xs font-medium text-muted">
                Monto pagado (COP)
                <input type="number" inputMode="numeric" value={monto} onChange={(e) => setMonto(e.target.value)} className={`${INPUT} mt-1`} />
              </label>
            )}
            {modo === "pago" && (
            <label className="text-xs font-medium text-muted">
              Vence el (opcional)
              <input
                type="date"
                value={venceEl}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setVenceEl(e.target.value)}
                className={`${INPUT} mt-1`}
              />
              <span className="mt-1 block text-[11px] font-normal text-muted">
                {venceEl
                  ? "El espacio queda activo hasta esa fecha."
                  : `Vacío = un ciclo del plan${ctx.espacio?.vence ? " desde su vencimiento actual" : " desde hoy"}.`}
              </span>
            </label>
            )}
            <label className="text-xs font-medium text-muted">
              Nota (opcional)
              <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej: Nequi, pagó con descuento" className={`${INPUT} mt-1`} />
            </label>
            {modo === "pago" && !ctx.tieneAdjunto && (
              <p className="text-[11px] text-muted">Sin archivo adjunto; el pago se registra sin comprobante.</p>
            )}

            {error && <p className="text-xs text-error">{error}</p>}

            <button
              type="button"
              onClick={guardar}
              disabled={guardando || !planId}
              className="flex items-center justify-center gap-2 rounded-[10px] bg-primary px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {guardando && <Loader2 size={15} className="animate-spin" />}
              {guardando
                ? "Guardando…"
                : modo === "demo"
                  ? destino === "espacio" && ctx.espacio
                    ? `Activar demo ${diasDemo} días`
                    : "Generar enlace demo"
                  : destino === "espacio" && ctx.espacio
                    ? "Registrar pago y activar"
                    : "Registrar pago y generar enlace"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
