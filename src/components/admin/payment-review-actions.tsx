"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { approvePayment, rejectPayment } from "@/app/actions/billing";

export function PaymentReviewActions({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function handle(action: (id: string) => Promise<unknown>) {
    setPending(true);
    setAviso(null);
    const r = (await action(paymentId)) as { aviso?: string } | undefined;
    setPending(false);
    // Aprobar un pago cuyo monto no coincide con su plan activa la cuenta pero no
    // cambia el plan: se lo decimos al administrador en vez de dejarlo suponer.
    if (r?.aviso) setAviso(r.aviso);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
      <button
        type="button"
        onClick={() => handle(approvePayment)}
        disabled={pending}
        className="flex items-center gap-1 rounded-md bg-success/15 px-2.5 py-1 text-xs text-success hover:bg-success/25 disabled:opacity-50"
      >
        <Check size={12} />
        Aprobar
      </button>
      <button
        type="button"
        onClick={() => handle(rejectPayment)}
        disabled={pending}
        className="flex items-center gap-1 rounded-md bg-red-500/15 px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/25 disabled:opacity-50"
      >
        <X size={12} />
        Rechazar
      </button>
      </div>
      {aviso && <p className="max-w-[260px] text-[11px] text-warning">{aviso}</p>}
    </div>
  );
}
