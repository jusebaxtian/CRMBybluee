"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { CreditCard, Loader2, Receipt, ShieldCheck } from "lucide-react";
import { crearOrdenBoldCurso, enviarComprobanteCurso } from "@/app/actions/cursos";

type Orden = {
  orderId: string;
  amount: number;
  currency: string;
  signature: string;
  apiKey: string;
  redirectUrl: string;
  description: string;
};

/**
 * Formas de pago de un curso: pasarela (Bold) o transferencia con
 * comprobante. Es el mismo esquema de la facturación del plan, para que el
 * cliente pague como ya sabe.
 */
export function ComprarCurso({
  cursoId,
  precio,
  datosTransferencia,
  hayPendiente,
}: {
  cursoId: string;
  precio: string;
  datosTransferencia: string | null;
  hayPendiente: boolean;
}) {
  const router = useRouter();
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
      <div className="rounded-[13px] border border-warning/40 bg-warning/10 p-5 text-sm text-warning">
        <p className="font-semibold">Tu pago está en revisión</p>
        <p className="mt-1 text-warning/90">
          Apenas lo confirmemos se te abre el curso aquí mismo. Si pagaste con tarjeta y ya fue aprobado, recarga esta
          página.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[13px] border border-border bg-surface p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <CreditCard size={16} className="text-primary" />
          Pagar con tarjeta o PSE
        </div>
        <p className="mb-3 text-[13px] text-muted">
          Pago seguro por la pasarela. El acceso se abre automáticamente al aprobarse.
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
            <p className="mt-2 text-xs text-muted">Si no ves el botón, recarga la página.</p>
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

      <div className="rounded-[13px] border border-border bg-surface p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Receipt size={16} className="text-primary" />
          Pagar por transferencia
        </div>
        {datosTransferencia && (
          <pre className="mb-3 whitespace-pre-wrap rounded-[9px] border border-border bg-background px-3 py-2 font-sans text-[13px] text-foreground">
            {datosTransferencia}
          </pre>
        )}
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
            className="flex items-center justify-center gap-2 rounded-[10px] border border-border px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-surface-hover disabled:opacity-50"
          >
            {subiendo && <Loader2 size={14} className="animate-spin" />}
            Enviar comprobante
          </button>
        </form>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      <p className="flex items-center gap-2 text-xs text-muted">
        <ShieldCheck size={13} /> El acceso queda ligado a tu espacio: lo ve todo tu equipo.
      </p>
    </div>
  );
}
