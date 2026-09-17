"use client";

import { useState } from "react";
import { BadgeDollarSign, Sparkles } from "lucide-react";
import { RegistrarPagoDialog } from "@/components/inbox/registrar-pago-dialog";

/**
 * Panel del contacto (solo admin): registrar un pago o crear una demo para
 * este contacto sin necesidad de un comprobante en el chat.
 */
export function BotonCuentaContacto({ contactId }: { contactId: string }) {
  const [modo, setModo] = useState<"pago" | "demo" | null>(null);
  return (
    <>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setModo("demo")}
          className="flex items-center justify-center gap-1.5 rounded-[9px] border border-primary/40 bg-primary/10 px-2 py-1.5 text-[11px] font-semibold text-primary hover:bg-primary/20"
        >
          <Sparkles size={13} /> Crear demo
        </button>
        <button
          type="button"
          onClick={() => setModo("pago")}
          className="flex items-center justify-center gap-1.5 rounded-[9px] border border-border px-2 py-1.5 text-[11px] font-semibold text-muted hover:border-primary hover:text-foreground"
        >
          <BadgeDollarSign size={13} /> Registrar pago
        </button>
      </div>
      {modo && <RegistrarPagoDialog contactId={contactId} modoInicial={modo} onClose={() => setModo(null)} />}
    </>
  );
}
