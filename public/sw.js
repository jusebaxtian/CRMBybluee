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

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();

  event.waitUntil(
    self.registration.showNotification(data.title || "CRM ByBluee", {
      body: data.body || "Tienes un nuevo mensaje",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.conversationId || "crm-bybluee-message",
      data: { url: data.url || "/dashboard/inbox" },
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/dashboard/inbox";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(targetUrl) && "focus" in client) {
            return client.focus();
          }
        }
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus();
            return client.navigate(targetUrl);
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
