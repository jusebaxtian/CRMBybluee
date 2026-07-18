"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { approvePayment, rejectPayment } from "@/app/actions/billing";

export function PaymentReviewActions({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handle(action: (id: string) => Promise<unknown>) {
    setPending(true);
    await action(paymentId);
    setPending(false);
    router.refresh();
  }

  return (
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
  );
}
