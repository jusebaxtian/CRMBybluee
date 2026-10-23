"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { CreditCard, Landmark, Loader2, ShieldCheck } from "lucide-react";
import { crearOrdenBoldCurso, enviarComprobanteCurso } from "@/app/actions/cursos";
import { DatosDeTransferencia } from "@/components/billing/datos-de-transferencia";

type Orden = {
  orderId: string;
  amount: number;
  currency: string;
  signature: string;
  apiKey: string;
  redirectUrl: string;
  description: string;
};

type Forma = "tarjeta" | "transferencia";

/**
 * El bloque de compra de un servicio: UNA sola seccion con las dos formas de
 * pago como pestañas --tarjeta o PSE por Bold, o transferencia con comprobante--.
 *
 * Antes la ficha tenia un boton "Comprar ahora" arriba y, mas abajo, otra tarjeta
 * con su propio boton de pago: dos botones de compra compitiendo. Ahora se elige
 * como pagar y se paga ahi mismo. La transferencia usa los mismos datos que
 * Facturacion (DatosDeTransferencia), no un texto distinto por servicio.
 */
export function ComprarCurso({
  cursoId,
  precio,
  hayPendiente,
}: {
  cursoId: string;
  precio: string;
  hayPendiente: boolean;
}) {
  const router = useRouter();
  const [forma, setForma] = useState<Forma>("tarjeta");
  const [orden, setOrden] = useState<Orden | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const [subiendo, setSubiendo] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function pagarConTarjeta() {
    setError(null);
    startTransition(async () => {
      const r = await crearOrdenBoldCurso(cursoId);
      if ("error" in r) {
        setError(r.error ?? "No se pudo abrir la pasarela.");
        return;
      }
      setOrden(r);
    });
  }

  async function enviarComprobante(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubiendo(true);
    const datos = new FormData(e.currentTarget);
    datos.set("cursoId", cursoId);
    const r = await enviarComprobanteCurso(datos);
    setSubiendo(false);
    if ("error" in r) {
      setError(r.error ?? "No se pudo enviar el comprobante.");
      return;
    }
    setOk(true);
    formRef.current?.reset();
    router.refresh();
  }

  if (hayPendiente || ok) {
    return (
      <div id="pagar" className="scroll-mt-4 rounded-[12px] border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
        <p className="font-semibold">Tu pago está en revisión</p>
        <p className="mt-1 text-warning/90">
          Apenas lo confirmemos se te abre el servicio aquí mismo. Si pagaste con tarjeta y ya fue aprobado, recarga esta
          página.
        </p>
      </div>
    );
  }

  const pestana = (valor: Forma, texto: string, icono: React.ReactNode) => (
    <button
      type="button"
      role="tab"
      aria-selected={forma === valor}
      onClick={() => {
        setForma(valor);
        setError(null);
      }}
      className={`flex items-center justify-center gap-1.5 rounded-[8px] px-3 py-2 text-[13px] font-semibold transition-colors ${
        forma === valor ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
      }`}
    >
      {icono}
      {texto}
    </button>
  );

  return (
    <div id="pagar" className="scroll-mt-4 flex flex-col gap-3 rounded-[12px] border border-border bg-background p-4">
      <p className="text-sm font-semibold text-foreground">Elige cómo pagar</p>

      <div role="tablist" aria-label="Forma de pago" className="grid grid-cols-2 gap-1 rounded-[10px] bg-surface-hover p-1">
        {pestana("tarjeta", "Tarjeta o PSE", <CreditCard size={14} />)}
        {pestana("transferencia", "Transferencia", <Landmark size={14} />)}
      </div>

      {forma === "tarjeta" ? (
        <div role="tabpanel" className="flex flex-col gap-3">
          <p className="text-[13px] text-muted">
            Pago seguro por la pasarela. El servicio se activa automáticamente al aprobarse.
          </p>
          {orden ? (
            <>
              <Script src="https://checkout.bold.co/library/boldPaymentButton.js" strategy="afterInteractive" />
              <script
                data-bold-button="dark-L"
                data-order-id={orden.orderId}
                data-currency={orden.currency}
                data-amount={orden.amount}
                data-api-key={orden.apiKey}
                data-integrity-signature={orden.signature}
                data-description={orden.description}
                data-redirection-url={orden.redirectUrl}
              />
              <p className="text-xs text-muted">Si no ves el botón de Bold, recarga la página.</p>
            </>
          ) : (
            <button
              type="button"
              onClick={pagarConTarjeta}
              disabled={pendiente}
              className="flex items-center justify-center gap-2 rounded-[10px] bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {pendiente && <Loader2 size={14} className="animate-spin" />}
              Pagar {precio}
            </button>
          )}
        </div>
      ) : (
        <div role="tabpanel" className="flex flex-col gap-3">
          <p className="text-[13px] text-muted">
            Transfiere <b className="text-foreground">{precio}</b> y sube el comprobante. Lo revisamos y se te activa el
            servicio.
          </p>
          <DatosDeTransferencia />
          <form ref={formRef} onSubmit={enviarComprobante} className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted">
              Comprobante (imagen o PDF)
              <input
                type="file"
                name="comprobante"
                accept="image/*,application/pdf"
                required
                className="mt-1 block w-full text-[13px] text-muted file:mr-3 file:rounded-[8px] file:border-0 file:bg-surface-hover file:px-3 file:py-1.5 file:text-[13px] file:text-foreground"
              />
            </label>
            <button
              type="submit"
              disabled={subiendo}
              className="flex items-center justify-center gap-2 rounded-[10px] bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {subiendo && <Loader2 size={14} className="animate-spin" />}
              Enviar comprobante
            </button>
          </form>
        </div>
      )}

      {error && <p className="text-sm text-error">{error}</p>}

      <p className="flex items-center gap-2 text-xs text-muted">
        <ShieldCheck size={13} /> El acceso queda ligado a tu espacio: lo ve todo tu equipo.
      </p>
    </div>
  );
}
