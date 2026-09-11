"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";

const SPEEDS = [1, 1.5, 2] as const;
const STORAGE_KEY = "bybluee_audio_playback_rate";

function readStoredRate(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = raw ? Number(raw) : 1;
    return (SPEEDS as readonly number[]).includes(n) ? n : 1;
  } catch {
    return 1;
  }
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Custom player (not the native <audio controls>) so a playback-speed toggle
// can live right next to the scrubber — the rate is remembered in
// localStorage and applied to every voice note going forward, since the
// point was "let me listen to ALL of them faster", not just this one.
export function VoiceMessagePlayer({ src, tint = "default" }: { src: string; tint?: "default" | "outbound" }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [rate, setRate] = useState(1);

  useEffect(() => {
    setRate(readStoredRate());
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate]);

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

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current;
    if (!audio) return;
    const t = Number(e.target.value);
    audio.currentTime = t;
    setCurrentTime(t);
  }

  const outbound = tint === "outbound";

  return (
    <div className="mb-1 flex w-56 max-w-full items-center gap-2">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        className="hidden"
      />
      <button
        type="button"
        onClick={togglePlay}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          outbound ? "bg-white/20 text-white" : "bg-primary/15 text-primary"
        }`}
        aria-label={playing ? "Pausar" : "Reproducir"}
      >
        {playing ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
      </button>

      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={currentTime}
        onChange={handleSeek}
        className={`h-1 flex-1 cursor-pointer accent-current ${outbound ? "text-white" : "text-primary"}`}
      />

      <span className={`shrink-0 text-[10px] tabular-nums ${outbound ? "text-white/80" : "text-muted"}`}>
        {formatTime(playing || currentTime > 0 ? currentTime : duration)}
      </span>

      <button
        type="button"
        onClick={cycleSpeed}
        title="Velocidad de reproducción"
        className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${
          outbound
            ? "border-white/30 text-white hover:bg-white/10"
            : "border-border text-muted hover:border-primary hover:text-primary"
        }`}
      >
        {rate}x
      </button>
    </div>
  );
}
