import { headers } from "next/headers";

/** Origen público de la app (detrás de nginx llega en x-forwarded-*). */
export async function origenPublico(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "crmbybluee.blue";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}
