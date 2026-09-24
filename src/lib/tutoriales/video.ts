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

/** Id de un archivo de Google Drive compartido por enlace. */
export function idDrive(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith("drive.google.com")) return null;
    // https://drive.google.com/file/d/<id>/view?usp=sharing
    const m = u.pathname.match(/\/file\/d\/([^/]+)/);
    if (m) return m[1];
    // https://drive.google.com/open?id=<id>
    return u.searchParams.get("id");
  } catch {
    return null;
  }
}

/** Id de un video de Vimeo. */
export function idVimeo(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith("vimeo.com")) return null;
    const m = u.pathname.match(/^\/(\d+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/**
 * Direccion para reproducir dentro de la plataforma, o null si ese enlace
 * no se puede incrustar (entonces se abre en otra pestaña).
 */
export function urlReproductor(url: string): string | null {
  const yt = idYoutube(url);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0`;
  const drive = idDrive(url);
  if (drive) return `https://drive.google.com/file/d/${drive}/preview`;
  const vimeo = idVimeo(url);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo}`;
  return null;
}

export function miniaturaYoutube(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}
