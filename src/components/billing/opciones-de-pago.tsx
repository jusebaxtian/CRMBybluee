import { CreditCard, Landmark } from "lucide-react";
import { BoldCheckoutButton } from "@/components/billing/bold-checkout-button";
import { ManualTransferForm } from "@/components/billing/manual-transfer-form";
import { WompiCheckoutButton } from "@/components/billing/wompi-checkout-button";
import { DatosDeTransferencia } from "@/components/billing/datos-de-transferencia";

type OrdenBold =
  | { error: string }
  | { success: true; orderId: string; amountCents: number; currency: string; signature: string; apiKey: string }
  | null;

/**
 * Las dos formas de pagar: tarjeta con Bold, o transferencia con comprobante.
 *
 * La usan la renovacion del plan actual y el cambio a otro plan. `planId` es el
 * plan que se esta comprando: viaja con el comprobante para que, al aprobarlo,
 * el espacio quede con ese plan. Sin el, se asume el plan que ya tiene.
 */
export function OpcionesDePago({
  boldOrder,
  descripcion,
  planId,
  montoSugeridoCop,
  wompiDisponible,
}: {
  boldOrder: OrdenBold;
  descripcion: string;
  planId?: string;
  /** Precio del plan en pesos, ya escrito en el formulario de la transferencia. */
  montoSugeridoCop?: number;
  wompiDisponible?: boolean;
}) {
  return (
    <div className={`grid grid-cols-1 gap-4 ${wompiDisponible ? "lg:grid-cols-3 sm:grid-cols-2" : "sm:grid-cols-2"}`}>
      <div className="rounded-[13px] border border-border bg-surface p-5">
        <div className="mb-3 flex items-center gap-2">
          <CreditCard size={18} className="text-primary" />
          <p className="font-medium text-foreground">Pagar con tarjeta (Bold)</p>
        </div>
        <p className="mb-4 text-sm text-muted">Pago inmediato, tu cuenta se activa automáticamente.</p>
        {boldOrder && "success" in boldOrder ? (
          <BoldCheckoutButton
            orderId={boldOrder.orderId}
            amountCents={boldOrder.amountCents}
            currency={boldOrder.currency}
            signature={boldOrder.signature}
            apiKey={boldOrder.apiKey}
            description={descripcion}
          />
        ) : (
          <p className="text-sm text-red-400">No se pudo preparar el pago.</p>
        )}
      </div>

      {wompiDisponible && (
        <div className="rounded-[13px] border border-border bg-surface p-5">
          <div className="mb-3 flex items-center gap-2">
            <CreditCard size={18} className="text-primary" />
            <p className="font-medium text-foreground">Tarjeta, Nequi o PSE (Wompi)</p>
          </div>
          <p className="mb-4 text-sm text-muted">Pago inmediato, tu cuenta se activa automáticamente.</p>
          <WompiCheckoutButton planId={planId} />
        </div>
      )}

      <div className="rounded-[13px] border border-border bg-surface p-5">
        <div className="mb-3 flex items-center gap-2">
          <Landmark size={18} className="text-primary" />
          <p className="font-medium text-foreground">Transferencia manual</p>
        </div>
        <p className="mb-3 text-sm text-muted">
          Transfiere a la cuenta de la empresa y sube tu comprobante — lo revisamos y activamos tu cuenta
          manualmente.
        </p>
        <div className="mb-4">
          <DatosDeTransferencia />
        </div>
        <ManualTransferForm planId={planId} montoSugeridoCop={montoSugeridoCop} />
      </div>
    </div>
  );
}
