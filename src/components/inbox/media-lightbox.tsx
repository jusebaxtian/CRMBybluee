"use client";

import { useEffect, useState } from "react";
import { X, Maximize2, ExternalLink } from "lucide-react";

/**
 * Muestra una imagen o un video del chat y permite abrirlo en grande.
 *
 * La imagen se abre tocándola. El video no: ahí el clic tiene que seguir
 * llegando a los controles de reproducción, así que lleva un botón de ampliar
 * en la esquina.
 */
export function MediaLightbox({
  src,
  kind,
  alt,
}: {
  src: string;
  kind: "image" | "video";
  alt?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);

    // Mientras el visor está abierto no debe moverse el chat de atrás.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      {kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt ?? "Imagen"}
          onClick={() => setOpen(true)}
          className="mb-1 max-h-72 w-full cursor-zoom-in rounded-md object-cover"
        />
      ) : (
        <div className="relative mb-1">
          <video src={src} controls className="max-h-72 w-full rounded-md" />
          <button
            type="button"
            onClick={() => setOpen(true)}
            title="Ver en grande"
            aria-label="Ver en grande"
            className="absolute right-2 top-2 rounded-md bg-black/60 p-1.5 text-white hover:bg-black/80"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setOpen(false)}
        >
          <div className="absolute right-3 top-3 flex items-center gap-2">
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="Abrir en una pestaña nueva"
              aria-label="Abrir en una pestaña nueva"
              className="rounded-md bg-white/10 p-2 text-white hover:bg-white/20"
            >
              <ExternalLink size={18} />
            </a>
            <button
              type="button"
              onClick={() => setOpen(false)}
              title="Cerrar"
              aria-label="Cerrar"
              className="rounded-md bg-white/10 p-2 text-white hover:bg-white/20"
            >
              <X size={18} />
            </button>
          </div>

          {kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={alt ?? "Imagen"}
              onClick={(e) => e.stopPropagation()}
              className="max-h-full max-w-full rounded-md object-contain"
            />
          ) : (
            <video
              src={src}
              controls
              autoPlay
              onClick={(e) => e.stopPropagation()}
              className="max-h-full max-w-full rounded-md"
            />
          )}
        </div>
      )}
    </>
  );
}
