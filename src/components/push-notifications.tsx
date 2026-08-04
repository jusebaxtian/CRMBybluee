"use client";

import { useEffect, useState } from "react";
import { Share, X, Bell } from "lucide-react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS 13+ reports as "MacIntel" but has touch support, unlike a real Mac.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS-only property — not in the DOM lib types.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

async function subscribeToPush(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;

  const registration = await navigator.serviceWorker.register("/sw.js");

  if (Notification.permission === "denied") return false;
  if (Notification.permission === "default") {
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

  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  });
  return true;
}

const IOS_BANNER_DISMISSED_KEY = "crm-ios-install-banner-dismissed";

export function PushNotifications() {
  // iOS only delivers push notifications to a site installed on the Home
  // Screen (standalone mode) — a normal Safari tab can never receive them,
  // no matter what the page does. There's also no way to trigger the
  // "Add to Home Screen" prompt from code on iOS (unlike Chrome's
  // beforeinstallprompt), so the only option is showing instructions.
  const [showIosInstallBanner, setShowIosInstallBanner] = useState(false);
  // iOS requires Notification.requestPermission() to originate from a real
  // user tap — calling it automatically on page load fails silently there.
  const [showEnableButton, setShowEnableButton] = useState(false);
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    if (isIos() && !isStandalone()) {
      const dismissed = localStorage.getItem(IOS_BANNER_DISMISSED_KEY);
      if (!dismissed) setShowIosInstallBanner(true);
      return;
    }

    if (Notification.permission === "default") {
      setShowEnableButton(true);
      return;
    }

    if (Notification.permission === "granted") {
      subscribeToPush().catch(() => {
        // Push isn't essential to using the dashboard — fail silently.
      });
    }
  }, []);

  async function handleEnableClick() {
    setEnabling(true);
    const ok = await subscribeToPush().catch(() => false);
    setEnabling(false);
    if (ok) setShowEnableButton(false);
  }

  function dismissIosBanner() {
    localStorage.setItem(IOS_BANNER_DISMISSED_KEY, "1");
    setShowIosInstallBanner(false);
  }

  if (showIosInstallBanner) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface p-3 shadow-lg">
        <div className="mx-auto flex max-w-lg items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Bell size={16} />
          </div>
          <p className="flex-1 text-xs text-foreground">
            Para recibir notificaciones de mensajes en tu iPhone (incluso con la pantalla
            bloqueada), agrega ByBluee a tu pantalla de inicio: toca{" "}
            <Share size={13} className="inline -translate-y-0.5" /> (Compartir) y luego{" "}
            <strong>&quot;Añadir a pantalla de inicio&quot;</strong>. Después ábrela desde ese
            ícono, no desde Safari.
          </p>
          <button
            type="button"
            onClick={dismissIosBanner}
            className="shrink-0 text-muted hover:text-foreground"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  if (showEnableButton) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface p-3 shadow-lg">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Bell size={16} />
          </div>
          <p className="flex-1 text-xs text-foreground">
            Activa las notificaciones para enterarte al instante quién te escribe, incluso con
            el celular bloqueado.
          </p>
          <button
            type="button"
            onClick={handleEnableClick}
            disabled={enabling}
            className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {enabling ? "Activando..." : "Activar"}
          </button>
          <button
            type="button"
            onClick={() => setShowEnableButton(false)}
            className="shrink-0 text-muted hover:text-foreground"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
