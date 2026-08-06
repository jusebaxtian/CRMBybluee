"use client";

import { useActionState } from "react";
import { updateSupportWhatsapp } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";

export function SupportWhatsappForm({
  currentNumber,
  currentMessage,
}: {
  currentNumber: string;
  currentMessage: string;
}) {
  const [state, action, pending] = useActionState(updateSupportWhatsapp, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label htmlFor="number" className="mb-1 block text-sm font-medium text-muted">
          Número de WhatsApp de soporte
        </label>
        <input
          id="number"
          name="number"
          type="text"
          required
          defaultValue={currentNumber}
          placeholder="573001234567 (indicativo + número, sin espacios ni +)"
          className="w-full max-w-sm rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
      </div>

      <div>
        <label htmlFor="message" className="mb-1 block text-sm font-medium text-muted">
          Mensaje predeterminado
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={3}
          defaultValue={currentMessage}
          placeholder="Hola, necesito ayuda con mi cuenta de ByBluee..."
          className="w-full max-w-lg rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
      </div>

      {state && "error" in state && <p className="text-sm text-red-400">{state.error}</p>}
      {state && "success" in state && (
        <p className="text-sm text-success">Guardado. Ya está activo para todos los clientes.</p>
      )}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Guardando..." : "Guardar"}
      </Button>
    </form>
  );
}
