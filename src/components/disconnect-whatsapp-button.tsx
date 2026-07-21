"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { disconnectWhatsApp } from "@/app/actions/whatsapp";

export function DisconnectWhatsAppButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const confirmed = window.confirm(
      "¿Desconectar WhatsApp? Dejarás de recibir y enviar mensajes hasta que vuelvas a conectar un número."
    );
    if (!confirmed) return;
    startTransition(async () => {
      await disconnectWhatsApp();
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="rounded-lg border border-red-400 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50"
    >
      {pending ? "Desconectando..." : "Desconectar WhatsApp"}
    </button>
  );
}
