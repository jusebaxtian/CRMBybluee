"use client";

import { useSyncExternalStore } from "react";
import { esTemporada, temporadaActiva, type IdTemporada } from "@/lib/temporadas/temporadas";

/** La etiqueta se vuelve a evaluar cada minuto: aparece y se quita sola, sin recargar. */
function suscribir(avisar: () => void) {
  const t = setInterval(avisar, 60_000);
  return () => clearInterval(t);
}

function activaAhora(): IdTemporada | null {
  // `?vista=halloween` o `?vista=navidad` dejan ver la etiqueta antes de la fecha (solo en el navegador).
  if (typeof window !== "undefined") {
    const forzada = new URLSearchParams(window.location.search).get("vista");
    if (esTemporada(forzada)) return forzada;
  }
  return temporadaActiva();
}

/** Etiqueta de temporada junto a "ByBluee": Halloween (calabaza + murcielago), Navidad (gorro + copos) u Ofertas (etiqueta de precio). */
export function EtiquetaDeTemporada() {
  const temporada = useSyncExternalStore(suscribir, activaAhora, () => temporadaActiva());
  if (temporada === "halloween") return <Halloween />;
  if (temporada === "navidad") return <Navidad />;
  if (temporada === "ofertas") return <Ofertas />;
  return null;
}

function Halloween() {
  return (
    <span
      className="relative flex h-[21px] shrink-0 items-center gap-[3px] rounded-full border border-[#ff7a1a] bg-[#2a1646] py-0 pl-[3px] pr-2 text-[10.4px] font-extrabold leading-none text-[#ffb15c]"
      title="¡Feliz Halloween!"
    >
      <svg width="17" height="17" viewBox="-12 -16 24 26" aria-hidden>
        <defs>
          <radialGradient id="cal-hw" cx="40%" cy="35%" r="70%">
            <stop offset="0" stopColor="#ffa83a" />
            <stop offset=".6" stopColor="#ff7a00" />
            <stop offset="1" stopColor="#c24d00" />
          </radialGradient>
        </defs>
        <ellipse cx="-6.5" cy="0" rx="8" ry="9.5" fill="url(#cal-hw)" />
        <ellipse cx="6.5" cy="0" rx="8" ry="9.5" fill="url(#cal-hw)" />
        <ellipse cx="0" cy="0" rx="8.5" ry="10.2" fill="url(#cal-hw)" />
        <path d="M-1.5 -9.5 C-1.5 -12 0.5 -13 1.8 -15 L4.2 -14 C3 -12.5 2.8 -11 2.8 -9.5 Z" fill="#46a02f" />
        <path d="M-5 -2.5 L-2 -5 L-1.2 -1.8 Z M5 -2.5 L2 -5 L1.2 -1.8 Z" fill="#2a1500" />
        <path d="M-5.5 3 Q0 8.5 5.5 3 L4 5.2 L2.2 3.6 L0.8 6 L-0.8 3.6 L-2.2 5.2 Z" fill="#2a1500" />
      </svg>
      Halloween
      <svg className="absolute -right-1 -top-2" width="14" height="9" viewBox="-20 -9 40 17" aria-hidden fill="#b58cf0">
        <path d="M0 0 C-3 -5 -11 -8 -19 -4 C-15 -3 -13 0 -13 4 C-10 1 -7 2 -5 6 C-4 3 -2 3 0 7 C2 3 4 3 5 6 C7 2 10 1 13 4 C13 0 15 -3 19 -4 C11 -8 3 -5 0 0 Z" />
      </svg>
    </span>
  );
}

function Copo({ className, color }: { className?: string; color: string }) {
  return (
    <svg className={className} width="9" height="9" viewBox="-5 -5 10 10" aria-hidden stroke={color} strokeWidth="1.1" strokeLinecap="round">
      <line x1="-4.2" y1="0" x2="4.2" y2="0" />
      <line x1="-4.2" y1="0" x2="4.2" y2="0" transform="rotate(60)" />
      <line x1="-4.2" y1="0" x2="4.2" y2="0" transform="rotate(120)" />
    </svg>
  );
}

function Navidad() {
  return (
    <span
      className="relative flex h-[21px] shrink-0 items-center gap-[4px] rounded-full border border-[#ffc233] bg-[#0f3d24] py-0 pl-[3px] pr-2 text-[10.4px] font-extrabold leading-none text-[#fff4d6]"
      title="¡Feliz Navidad!"
    >
      <svg width="19" height="17" viewBox="-11 -12 24 25" aria-hidden>
        <path d="M-9 6 C-9 -4 -3 -11 5 -10 C8 -9.5 10 -7 10 -4 C6 -6 2 -3 1 6 Z" fill="#e63946" />
        <path d="M-10 4.5 Q0 9 11 4.5 L11 8.5 Q0 13 -10 8.5 Z" fill="#fff" />
        <circle cx="10.5" cy="-5" r="3.4" fill="#fff" />
      </svg>
      Navidad
      <Copo className="absolute -right-1.5 -top-2" color="#cfe9ff" />
      <Copo className="ml-0.5" color="#ffe9a8" />
    </span>
  );
}

/** Etiqueta de precio con "%" y dos destellos, sin texto. */
function Ofertas() {
  return (
    <span className="relative flex h-[22px] w-[34px] shrink-0 items-center justify-center" title="¡Ofertas!" role="img" aria-label="Ofertas">
      <svg width="34" height="24" viewBox="-17 -12 34 24" aria-hidden>
        <g transform="rotate(-18)">
          <path d="M-12 -8 L6 -8 L13 0 L6 8 L-12 8 Z" fill="#ffd23d" />
          <circle cx="-7.5" cy="0" r="2" fill="#13131c" />
          <text x="1.5" y="3.8" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="10.5" fill="#13131c">%</text>
        </g>
        <path transform="translate(13 -8)" d="M0 -3.6 L1 -1 L3.6 0 L1 1 L0 3.6 L-1 1 L-3.6 0 L-1 -1 Z" fill="#ffd23d" />
        <path transform="translate(-14 -6)" d="M0 -2.6 L0.7 -0.7 L2.6 0 L0.7 0.7 L0 2.6 L-0.7 0.7 L-2.6 0 L-0.7 -0.7 Z" fill="#ffd23d" />
      </svg>
    </span>
  );
}
