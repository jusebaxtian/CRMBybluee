"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { avanceDeAudio, formatoDeTiempo, ondaDeAudio, razonDelPuntero } from "@/lib/inbox/audio-de-nota";

const SPEEDS = [1, 1.5, 2] as const;
const STORAGE_KEY = "bybluee_audio_playback_rate";
const BARRAS = 40;

function readStoredRate(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = raw ? Number(raw) : 1;
    return (SPEEDS as readonly number[]).includes(n) ? n : 1;
  } catch {
    return 1;
  }
}

// Reproductor propio (no el <audio controls> nativo): la velocidad vive junto
// a la onda y se recuerda en localStorage para todos los audios, porque la
// idea era "escucharlos todos mas rapido", no solo este.
//
// La onda de barras sirve para dos cosas: reconocer cada audio de un vistazo
// y adelantar tocando o arrastrando sobre ella, una zona mucho mas facil de
// acertar que la barra delgada que habia antes. Ver `ondaDeAudio`: la forma es
// generada, no el volumen real del audio.
export function VoiceMessagePlayer({
  src,
  tint = "default",
  transcripcion = null,
}: {
  src: string;
  tint?: "default" | "outbound";
  /** Texto del audio, si llego transcrito. Se muestra debajo y se puede ocultar. */
  transcripcion?: string | null;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const ondaRef = useRef<HTMLDivElement>(null);
  const arrastrando = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [rate, setRate] = useState(1);
  const [textoVisible, setTextoVisible] = useState(true);

  const barras = useMemo(() => ondaDeAudio(src, BARRAS), [src]);

  useEffect(() => {
    setRate(readStoredRate());
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate]);

  // El evento timeupdate llega ~4 veces por segundo y la onda se veria a saltos;
  // mientras suena se lee el tiempo en cada cuadro.
  useEffect(() => {
    if (!playing) return;
    let id = 0;
    const paso = () => {
      const audio = audioRef.current;
      if (audio) setCurrentTime(audio.currentTime);
      id = requestAnimationFrame(paso);
    };
    id = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(id);
  }, [playing]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
  }

  function cycleSpeed() {
    const nextIndex = (SPEEDS.indexOf(rate as (typeof SPEEDS)[number]) + 1) % SPEEDS.length;
    const next = SPEEDS[nextIndex];
    setRate(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // Private browsing or storage disabled — speed still applies for this session.
    }
  }

  // Los audios grabados en el navegador pueden no traer la duracion en la
  // cabecera (Infinity); sin ella no se puede adelantar a una posicion.
  const puedeAdelantar = Number.isFinite(duration) && duration > 0;

  function irA(clientX: number) {
    const audio = audioRef.current;
    const onda = ondaRef.current;
    if (!audio || !onda || !puedeAdelantar) return;
    const rect = onda.getBoundingClientRect();
    const t = razonDelPuntero(clientX, rect.left, rect.width) * duration;
    audio.currentTime = t;
    setCurrentTime(t);
  }

  function alPulsarOnda(e: React.PointerEvent<HTMLDivElement>) {
    if (!puedeAdelantar) return;
    arrastrando.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    irA(e.clientX);
  }

  function alTeclearOnda(e: React.KeyboardEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    if (!audio || !puedeAdelantar || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
    e.preventDefault();
    const t = Math.min(duration, Math.max(0, audio.currentTime + (e.key === "ArrowRight" ? 5 : -5)));
    audio.currentTime = t;
    setCurrentTime(t);
  }

  const outbound = tint === "outbound";
  const avance = avanceDeAudio(currentTime, duration);
  const mostrado = playing || currentTime > 0 ? currentTime : duration;

  const claseBarraApagada = outbound ? "bg-white/35" : "bg-muted/40";
  const claseBarraEncendida = outbound
    ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]"
    : "bg-primary shadow-[0_0_8px_color-mix(in_srgb,var(--color-primary)_55%,transparent)]";

  return (
    <div className="mb-1 w-64 max-w-full">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          // Al terminar vuelve al principio: se ve la duracion y se puede repetir.
          if (audioRef.current) audioRef.current.currentTime = 0;
          setCurrentTime(0);
        }}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        className="hidden"
      />

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={togglePlay}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95 ${
            outbound
              ? "bg-white text-primary shadow-md"
              : "bg-gradient-to-br from-primary to-teal-500 text-white shadow-md shadow-primary/30"
          }`}
          aria-label={playing ? "Pausar" : "Reproducir"}
        >
          {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
        </button>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div
            ref={ondaRef}
            role="slider"
            tabIndex={0}
            aria-label="Posición del audio"
            aria-valuemin={0}
            aria-valuemax={puedeAdelantar ? Math.round(duration) : 0}
            aria-valuenow={Math.round(currentTime)}
            aria-valuetext={`${formatoDeTiempo(currentTime)} de ${formatoDeTiempo(duration)}`}
            onPointerDown={alPulsarOnda}
            onPointerMove={(e) => arrastrando.current && irA(e.clientX)}
            onPointerUp={() => (arrastrando.current = false)}
            onPointerCancel={() => (arrastrando.current = false)}
            onKeyDown={alTeclearOnda}
            className={`group/onda relative flex h-8 touch-none select-none items-center gap-[2px] rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              puedeAdelantar ? "cursor-pointer" : ""
            }`}
          >
            {barras.map((a, i) => (
              <span
                key={i}
                style={{ height: `${Math.round(8 + a * 22)}px` }}
                className={`min-w-[2px] flex-1 rounded-full transition-colors duration-100 ${
                  i / BARRAS < avance ? claseBarraEncendida : claseBarraApagada
                }`}
              />
            ))}
            <span
              aria-hidden
              style={{ left: `${avance * 100}%` }}
              className={`pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity ${
                outbound ? "bg-white ring-4 ring-white/30" : "bg-teal-400 ring-4 ring-teal-400/30"
              } ${playing ? "opacity-100" : "opacity-0 group-hover/onda:opacity-100"}`}
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className={`shrink-0 text-[10px] tabular-nums ${outbound ? "text-white/80" : "text-muted"}`}>
              {formatoDeTiempo(mostrado)}
            </span>
            {transcripcion && (
              <button
                type="button"
                onClick={() => setTextoVisible((v) => !v)}
                aria-expanded={textoVisible}
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  outbound ? "bg-white/15 text-white hover:bg-white/25" : "bg-primary/10 text-primary hover:bg-primary/20"
                }`}
              >
                {textoVisible ? "Ocultar texto" : "Ver texto"}
              </button>
            )}
            <button
              type="button"
              onClick={cycleSpeed}
              title="Velocidad de reproducción"
              className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${
                outbound
                  ? "border-white/40 text-white hover:bg-white/10"
                  : "border-border text-primary hover:border-primary"
              }`}
            >
              {rate}x
            </button>
          </div>
        </div>
      </div>

      {transcripcion && textoVisible && (
        <p className="mt-1.5 whitespace-pre-wrap break-words text-[13px] leading-snug">{transcripcion}</p>
      )}
    </div>
  );
}
