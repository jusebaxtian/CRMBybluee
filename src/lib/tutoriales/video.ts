/** Modulos de la plataforma para agrupar tutoriales (migracion 0116). */
export const MODULOS_TUTORIAL: { value: string; label: string }[] = [
  { value: "empezar", label: "Empezar" },
  { value: "conversaciones", label: "Conversaciones" },
  { value: "contactos", label: "Contactos" },
  { value: "campanas", label: "Campañas" },
  { value: "automatizaciones", label: "Automatizaciones" },
  { value: "agente_ia", label: "Agente IA" },
  { value: "agenda", label: "Agenda" },
  { value: "configuracion", label: "Configuración" },
  { value: "otros", label: "Otros" },
];

export function etiquetaModulo(value: string): string {
  return MODULOS_TUTORIAL.find((m) => m.value === value)?.label ?? value;
}

/** Id de YouTube si la URL es de YouTube (watch, youtu.be, shorts, embed); null si no. */
export function idYoutube(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/);
      if (m) return m[1];
    }
  } catch {
    return null;
  }
  return null;
}

export function miniaturaYoutube(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}
