"use client";

import { useState } from "react";
import { BadgeDollarSign, Link2, Sparkles } from "lucide-react";
import { RegistrarPagoDialog } from "@/components/inbox/registrar-pago-dialog";
import { VincularEspacioDialog } from "@/components/inbox/vincular-espacio-dialog";

/**
 * Panel del contacto (solo admin): crear una demo, registrar un pago o
 * vincular este chat a un espacio (hasta 5 contactos por espacio, 0191). Los
 * tres en una linea.
 */
export function BotonCuentaContacto({ contactId }: { contactId: string }) {
  const [modo, setModo] = useState<"pago" | "demo" | "vincular" | null>(null);
  const boton =
    "flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-[9px] border px-1 py-1.5 text-center text-[10.5px] font-semibold leading-tight";
  return (
    <>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={() => setModo("demo")}
          className={`${boton} border-primary/40 bg-primary/10 text-primary hover:bg-primary/20`}
        >
          <Sparkles size={14} className="shrink-0" />
          <span>Crear demo</span>
        </button>
        <button
          type="button"
          onClick={() => setModo("pago")}
          className={`${boton} border-border text-muted hover:border-primary hover:text-foreground`}
        >
          <BadgeDollarSign size={14} className="shrink-0" />
          <span>Registrar pago</span>
        </button>
        <button
          type="button"
          onClick={() => setModo("vincular")}
          title="Vincular este chat a un espacio"
          className={`${boton} border-border text-muted hover:border-primary hover:text-foreground`}
        >
          <Link2 size={14} className="shrink-0" />
          <span>Vincular espacio</span>
        </button>
      </div>
      {(modo === "pago" || modo === "demo") && (
        <RegistrarPagoDialog contactId={contactId} modoInicial={modo} onClose={() => setModo(null)} />
      )}
      {modo === "vincular" && <VincularEspacioDialog contactId={contactId} onClose={() => setModo(null)} />}
    </>
  );
}
