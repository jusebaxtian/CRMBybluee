"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadPaymentProof } from "@/app/actions/billing";

export function ManualTransferForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(
    null
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setMessage(null);

    const formData = new FormData(e.currentTarget);
    const result = await uploadPaymentProof(formData);
    setPending(false);

    if ("error" in result) {
      setMessage({ type: "error", text: result.error ?? "Ocurrió un error." });
      return;
    }

    setMessage({ type: "success", text: "Comprobante enviado. Lo revisaremos pronto." });
    formRef.current?.reset();
    router.refresh();
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label htmlFor="amount" className="mb-1 block text-xs font-medium text-muted">
          Monto pagado (COP)
        </label>
        <input
          id="amount"
          name="amount"
          type="number"
          required
          placeholder="150000"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
      </div>
      <div>
        <label htmlFor="proof" className="mb-1 block text-xs font-medium text-muted">
          Comprobante de transferencia
        </label>
        <input
          id="proof"
          name="proof"
          type="file"
          required
          accept="image/*,application/pdf"
          className="w-full text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:text-white"
        />
      </div>
      {message && (
        <p className={`text-sm ${message.type === "error" ? "text-red-400" : "text-success"}`}>
          {message.text}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
      >
        {pending ? "Enviando..." : "Enviar comprobante"}
      </button>
    </form>
  );
}
