// Pagina "Sin conexion": se guarda al instalar y se sirve cuando una
// navegacion falla por falta de red (reemplaza el "This page couldn't load"
// del navegador / la PWA). Subir la version limpia la cache vieja.
const CACHE_OFFLINE = "bybluee-offline-v1";
const PAGINA_OFFLINE = "/sin-conexion.html";
const PRECACHE = [PAGINA_OFFLINE, "/logo.png", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_OFFLINE)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_OFFLINE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Solo navegaciones (abrir/recargar una pagina). Datos, imagenes y
  // realtime siguen yendo directo a la red sin tocar la cache.
  if (request.mode !== "navigate" || request.method !== "GET") return;

  event.respondWith(
    fetch(request).catch(async () => {
      const cache = await caches.open(CACHE_OFFLINE);
      const offline = await cache.match(PAGINA_OFFLINE);
      return offline || new Response("Sin conexión", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    })
  );
});

// ---------------------------------------------------------------------------
// Notificaciones de mensajes nuevos. Se comportan como una app de mensajes:
// - Una notificacion por chat (mismo `tag`), y CADA mensaje nuevo vuelve a sonar y
//   vibrar (`renotify`). Antes la siguiente reemplazaba a la anterior en silencio.
// - Los mensajes seguidos del mismo chat se apilan (los ultimos tres) con su cuenta en el titulo.
// - El icono de la app muestra cuantos chats tienen aviso pendiente.
// ---------------------------------------------------------------------------
const MAX_MENSAJES_APILADOS = 5;
const MENSAJES_VISIBLES = 3;

async function actualizarInsignia() {
  try {
    const nav = self.navigator;
    if (!nav || !nav.setAppBadge) return;
    const pendientes = await self.registration.getNotifications();
    if (pendientes.length > 0) await nav.setAppBadge(pendientes.length);
    else if (nav.clearAppBadge) await nav.clearAppBadge();
  } catch {
    // La insignia es un extra: si el sistema no la admite, no pasa nada.
  }
}

async function mostrarAviso(data) {
  const tag = data.tag || data.conversationId || "crm-bybluee-message";
  const previas = await self.registration.getNotifications({ tag });
  const anteriores = (previas[0] && previas[0].data && previas[0].data.mensajes) || [];
  const total = ((previas[0] && previas[0].data && previas[0].data.total) || 0) + 1;
  const mensajes = [...anteriores, data.body || "Tienes un nuevo mensaje"].slice(-MAX_MENSAJES_APILADOS);
  const titulo = (data.title || "CRM ByBluee") + (total > 1 ? ` (${total})` : "");

  await self.registration.showNotification(titulo, {
    body: mensajes.slice(-MENSAJES_VISIBLES).join("\n"),
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag,
    renotify: true,
    timestamp: Date.now(),
    vibrate: [200, 100, 200],
    actions: [{ action: "abrir", title: "Abrir chat" }],
    data: { url: data.url || "/dashboard/inbox", mensajes, total },
  });
  await actualizarInsignia();
}

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data;
  try {
    data = event.data.json();
  } catch {
    data = { body: event.data.text() };
  }
  event.waitUntil(mostrarAviso(data));
});

self.addEventListener("notificationclose", (event) => {
  event.waitUntil(actualizarInsignia());
});

// Si el navegador cambia o renueva la suscripcion, se vuelve a registrar sola:
// sin esto la persona deja de recibir avisos sin enterarse.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const clave = event.oldSubscription && event.oldSubscription.options && event.oldSubscription.options.applicationServerKey;
        const nueva =
          event.newSubscription ||
          (clave ? await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: clave }) : null);
        if (!nueva) return;
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(nueva),
        });
      } catch {
        // Se reintenta la proxima vez que la persona abra la app.
      }
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/dashboard/inbox";

  event.waitUntil(
    (async () => {
      await actualizarInsignia();
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && "focus" in client) return client.focus();
      }
      for (const client of clientList) {
        if ("focus" in client) {
          await client.focus();
          return client.navigate(targetUrl);
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })()
  );
});
