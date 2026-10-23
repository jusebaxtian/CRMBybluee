"use client";

import { useCallback, useEffect, useState } from "react";
import { calcularEstado, type EstadoNotificaciones } from "@/lib/push/estado";

/**
 * Todo lo del navegador para las notificaciones: estado, activar, probar e
 * instalar la app. Lo usan el boton de la barra superior y el aviso de abajo,
 * asi los dos dicen siempre lo mismo.
 */

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function esIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS 13+ se presenta como "MacIntel" pero tiene pantalla tactil, a diferencia de un Mac.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function estaInstalada(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Propiedad solo de iOS: no esta en los tipos del DOM.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

type EventoInstalar = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// Chrome dispara "beforeinstallprompt" una sola vez y a veces antes de que el componente exista:
// se guarda aqui, a nivel de modulo, para que cualquiera lo pueda usar despues.
let eventoInstalar: EventoInstalar | null = null;
const oyentes = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    eventoInstalar = e as EventoInstalar;
    oyentes.forEach((f) => f());
  });
  window.addEventListener("appinstalled", () => {
    eventoInstalar = null;
    oyentes.forEach((f) => f());
  });
}

function soportaPush(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** Registra este dispositivo. `pedirPermiso` solo con un toque de la persona (iPhone lo exige). */
async function suscribir(pedirPermiso: boolean): Promise<boolean> {
  if (!soportaPush()) return false;

  const registration = await navigator.serviceWorker.register("/sw.js");

  if (Notification.permission === "denied") return false;
  if (Notification.permission === "default") {
    if (!pedirPermiso) return false;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) return false;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  // Se guarda siempre (no solo al crearla): si la fila se perdio o paso a otra cuenta, se reconstruye sola.
  const r = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  });
  return r.ok;
}

export type ResultadoPrueba = { ok: boolean; mensaje: string };

export function useNotificaciones() {
  const [estado, setEstado] = useState<EstadoNotificaciones | "cargando">("cargando");
  const [puedeInstalar, setPuedeInstalar] = useState(false);
  const [trabajando, setTrabajando] = useState(false);

  const evaluar = useCallback(async () => {
    const soportado = soportaPush();
    let suscrito = false;
    if (soportado && Notification.permission === "granted") {
      try {
        const reg = (await navigator.serviceWorker.getRegistration("/sw.js")) ?? (await navigator.serviceWorker.getRegistration());
        suscrito = !!(await reg?.pushManager.getSubscription());
      } catch {
        suscrito = false;
      }
    }
    setEstado(
      calcularEstado({
        soportado,
        esIos: esIos(),
        instalada: estaInstalada(),
        permiso: typeof Notification === "undefined" ? "unsupported" : Notification.permission,
        suscrito,
      })
    );
  }, []);

  useEffect(() => {
    const avisar = () => setPuedeInstalar(eventoInstalar !== null && !estaInstalada());
    oyentes.add(avisar);
    avisar();

    // Con el permiso ya dado se vuelve a registrar el dispositivo en silencio en cada carga.
    const iniciar = async () => {
      if (soportaPush() && Notification.permission === "granted") {
        await suscribir(false).catch(() => false);
      }
      await evaluar();
    };
    void iniciar();

    return () => {
      oyentes.delete(avisar);
    };
  }, [evaluar]);

  const activar = useCallback(async () => {
    setTrabajando(true);
    const ok = await suscribir(true).catch(() => false);
    await evaluar();
    setTrabajando(false);
    return ok;
  }, [evaluar]);

  const probar = useCallback(async (): Promise<ResultadoPrueba> => {
    setTrabajando(true);
    try {
      const r = await fetch("/api/push/prueba", { method: "POST" });
      const d = (await r.json()) as { ok?: boolean; error?: string; motivo?: string; enviados?: number };
      if (r.status === 429) return { ok: false, mensaje: d.error ?? "Espera unos segundos." };
      if (d.ok) return { ok: true, mensaje: "Listo: te mandamos una notificación. Debe llegar en unos segundos." };
      return { ok: false, mensaje: d.motivo ?? "No se pudo enviar la prueba. Intenta activar de nuevo las notificaciones." };
    } catch {
      return { ok: false, mensaje: "No se pudo enviar la prueba. Revisa tu conexión." };
    } finally {
      setTrabajando(false);
    }
  }, []);

  const instalar = useCallback(async () => {
    if (!eventoInstalar) return false;
    await eventoInstalar.prompt();
    const { outcome } = await eventoInstalar.userChoice;
    eventoInstalar = null;
    oyentes.forEach((f) => f());
    return outcome === "accepted";
  }, []);

  return { estado, puedeInstalar, trabajando, activar, probar, instalar, reevaluar: evaluar };
}
