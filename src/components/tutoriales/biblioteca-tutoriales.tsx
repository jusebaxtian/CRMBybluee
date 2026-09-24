"use client";

import { useEffect, useState } from "react";
import { Check, ExternalLink, Play, X } from "lucide-react";
import { MODULOS_TUTORIAL, etiquetaModulo, idYoutube, miniaturaYoutube, urlReproductor } from "@/lib/tutoriales/video";

export type Tutorial = {
  id: string;
  titulo: string;
  descripcion: string | null;
  url: string;
  modulo: string;
  duracion: string | null;
};

const CLAVE_VISTOS = "bybluee:tutoriales-vistos";

function leerVistos(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_VISTOS) ?? "[]");
  } catch {
    return [];
  }
}

/**
 * Biblioteca de tutoriales: filtros por modulo, tarjetas con miniatura y
 * reproductor embebido para YouTube (otras URLs abren en pestana nueva).
 * "Visto" se guarda solo en este navegador.
 */
export function BibliotecaTutoriales({ tutoriales, abrirInicial }: { tutoriales: Tutorial[]; abrirInicial?: string | null }) {
  const [filtro, setFiltro] = useState("todos");
  const [vistos, setVistos] = useState<string[]>([]);
  const [abierto, setAbierto] = useState<Tutorial | null>(null);

  // Estado guardado en el navegador: se lee al montar (no existe en el servidor).
  useEffect(() => {
    const guardados = leerVistos();
    const inicial = abrirInicial ? tutoriales.find((t) => t.id === abrirInicial) ?? null : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVistos(guardados);
    if (inicial) setAbierto(inicial);
  }, [abrirInicial, tutoriales]);

  function abrir(t: Tutorial) {
    if (!vistos.includes(t.id)) {
      const nuevos = [...vistos, t.id];
      setVistos(nuevos);
      try {
        localStorage.setItem(CLAVE_VISTOS, JSON.stringify(nuevos));
      } catch {}
    }
    if (urlReproductor(t.url)) setAbierto(t);
    else window.open(t.url, "_blank", "noopener,noreferrer");
  }

  const modulosConVideos = MODULOS_TUTORIAL.filter((m) => tutoriales.some((t) => t.modulo === m.value));
  const lista = filtro === "todos" ? tutoriales : tutoriales.filter((t) => t.modulo === filtro);
  const vistosCount = tutoriales.filter((t) => vistos.includes(t.id)).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip activo={filtro === "todos"} onClick={() => setFiltro("todos")}>
          Todos
        </Chip>
        {modulosConVideos.map((m) => (
          <Chip key={m.value} activo={filtro === m.value} onClick={() => setFiltro(m.value)}>
            {m.label}
          </Chip>
        ))}
        <span className="ml-auto text-xs text-muted">
          {vistosCount} de {tutoriales.length} vistos
        </span>
      </div>

      {lista.length === 0 && (
        <div className="rounded-[13px] border border-border bg-surface p-10 text-center text-sm text-muted">
          Pronto habrá capacitaciones aquí.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {lista.map((t) => {
          const yt = idYoutube(t.url);
          const reproducible = !!urlReproductor(t.url);
          const visto = vistos.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => abrir(t)}
              className="group flex flex-col overflow-hidden rounded-[13px] border border-border bg-surface text-left transition-colors hover:border-primary/60"
            >
              <div className="relative aspect-video w-full bg-gradient-to-br from-[#16351f] to-[#0e1411]">
                {yt && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={miniaturaYoutube(yt)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
                )}
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform group-hover:scale-110">
                    {reproducible ? <Play size={16} fill="currentColor" /> : <ExternalLink size={16} />}
                  </span>
                </span>
                {t.duracion && (
                  <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] text-white">{t.duracion}</span>
                )}
                {visto && (
                  <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">
                    <Check size={10} /> VISTO
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-0.5 p-3">
                <p className="text-[13.5px] font-semibold text-foreground">{t.titulo}</p>
                <p className="text-xs text-muted">{etiquetaModulo(t.modulo)}</p>
                {t.descripcion && <p className="mt-1 line-clamp-2 text-xs text-muted">{t.descripcion}</p>}
              </div>
            </button>
          );
        })}
      </div>

      {abierto && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4" onClick={() => setAbierto(null)}>
          <div className="w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between text-white">
              <p className="text-sm font-semibold">{abierto.titulo}</p>
              <button type="button" onClick={() => setAbierto(null)} aria-label="Cerrar" className="rounded-full p-1 hover:bg-white/10">
                <X size={20} />
              </button>
            </div>
            <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
              <iframe
                src={urlReproductor(abierto.url) ?? ""}
                title={abierto.titulo}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
        activo ? "bg-primary text-white" : "border border-border text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
