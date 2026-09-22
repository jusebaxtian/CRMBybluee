"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Lock, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { INPUT_AUTH, INPUT_AUTH_BASE } from "@/components/auth/campos";
import { listaDePaises, PAIS_POR_DEFECTO, type Pais } from "@/lib/auth/telefono";

/**
 * [ 🇨🇴 Colombia +57 ▼ ] [ Número de WhatsApp ]
 *
 * La persona elige el pais (con buscador) y escribe solo su numero local; el
 * indicativo lo pone el sistema. Se envian dos campos al servidor:
 *   phoneCountry = "CO"   phone = "3001234567"
 * y alli componerTelefono() valida y arma el E.164.
 */
export function CampoTelefono({
  etiqueta = "Número de WhatsApp",
  error,
  paisInicial = PAIS_POR_DEFECTO,
  numeroInicial = "",
  disabled,
  fijo = false,
}: {
  etiqueta?: string;
  error?: string | null;
  paisInicial?: string;
  numeroInicial?: string;
  disabled?: boolean;
  /** El numero viene del enlace de registro: se muestra pero no se edita. */
  fijo?: boolean;
}) {
  const id = useId();
  const paises = useMemo(() => listaDePaises(), []);
  const [iso, setIso] = useState(paisInicial);
  const [numero, setNumero] = useState(numeroInicial);
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [resaltado, setResaltado] = useState(0);
  const contenedor = useRef<HTMLDivElement>(null);
  const inputBusqueda = useRef<HTMLInputElement>(null);

  const pais: Pais = paises.find((p) => p.iso === iso) ?? paises[0];

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return paises;
    const qDigitos = q.replace(/\D/g, "");
    return paises.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        p.iso.toLowerCase() === q ||
        (qDigitos && p.indicativo.replace("+", "").startsWith(qDigitos))
    );
  }, [paises, busqueda]);

  useEffect(() => {
    if (!abierto) return;
    inputBusqueda.current?.focus();
    function cerrarFuera(e: MouseEvent) {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", cerrarFuera);
    return () => document.removeEventListener("mousedown", cerrarFuera);
  }, [abierto]);

  function elegir(p: Pais) {
    setIso(p.iso);
    setAbierto(false);
    setBusqueda("");
  }

  function teclado(e: React.KeyboardEvent) {
    if (e.key === "Escape") setAbierto(false);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setResaltado((r) => Math.min(r + 1, filtrados.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setResaltado((r) => Math.max(r - 1, 0));
    }
    if (e.key === "Enter" && filtrados[resaltado]) {
      e.preventDefault();
      elegir(filtrados[resaltado]);
    }
  }

  return (
    <div>
      <label htmlFor={`${id}-numero`} className="mb-1.5 block text-[13px] font-medium text-foreground">
        {etiqueta}
      </label>
      <div ref={contenedor} className="relative flex gap-2">
        <input type="hidden" name="phoneCountry" value={iso} />

        <button
          type="button"
          disabled={disabled || fijo}
          onClick={() => !fijo && setAbierto((a) => !a)}
          aria-haspopup="listbox"
          aria-expanded={abierto}
          aria-label={`País: ${pais.nombre} ${pais.indicativo}`}
          className={cn(
            INPUT_AUTH_BASE,
            "flex w-[118px] shrink-0 items-center gap-2 px-3 text-left sm:w-[172px]",
            error && "border-error",
            fijo && "cursor-default opacity-90"
          )}
        >
          <Bandera pais={pais} />
          <span className="hidden min-w-0 flex-1 truncate text-[13px] sm:block">{pais.nombre}</span>
          <span className="text-[13px] font-semibold text-muted">{pais.indicativo}</span>
          {!fijo && <ChevronDown size={14} className="ml-auto shrink-0 text-muted" />}
        </button>

        <input
          id={`${id}-numero`}
          className={cn(INPUT_AUTH, "min-w-0 flex-1")}
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          required
          disabled={disabled}
          readOnly={fijo}
          value={numero}
          onChange={(e) => !fijo && setNumero(e.target.value.replace(/[^\d\s-]/g, ""))}
          placeholder="Número de WhatsApp"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />

        {fijo && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" title="Número del enlace: no se puede cambiar">
            <Lock size={14} />
          </span>
        )}

        {abierto && !fijo && (
          <div
            className="absolute left-0 top-[calc(100%+6px)] z-20 w-full max-w-[340px] overflow-hidden rounded-[12px] border border-border bg-surface shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
            onKeyDown={teclado}
          >
            <div className="relative border-b border-border p-2">
              <Search size={14} className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                ref={inputBusqueda}
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value);
                  setResaltado(0);
                }}
                placeholder="Buscar país o indicativo"
                aria-label="Buscar país"
                className="h-9 w-full rounded-[8px] bg-background pl-8 pr-3 text-[13px] text-foreground outline-none placeholder:text-muted/70"
              />
            </div>
            <ul role="listbox" className="max-h-[240px] overflow-y-auto py-1">
              {filtrados.length === 0 && (
                <li className="px-3 py-2 text-[13px] text-muted">Sin resultados</li>
              )}
              {filtrados.map((p, i) => (
                <li
                  key={p.iso}
                  role="option"
                  aria-selected={p.iso === iso}
                  onMouseEnter={() => setResaltado(i)}
                  onClick={() => elegir(p)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[13px]",
                    i === resaltado ? "bg-surface-hover text-foreground" : "text-foreground",
                    p.iso === iso && "font-semibold text-success"
                  )}
                >
                  <Bandera pais={p} />
                  <span className="min-w-0 flex-1 truncate">{p.nombre}</span>
                  <span className="text-muted">{p.indicativo}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-[12.5px] text-error">
          {error}
        </p>
      ) : (
        <p className="mt-1.5 text-[12px] text-muted">
          {fijo
            ? "Este es el número de tu enlace: no se puede cambiar."
            : "Solo el número local, sin el indicativo. Ej: 3001234567"}
        </p>
      )}
    </div>
  );
}

/**
 * Bandera como imagen: el emoji 🇨🇴 no se dibuja en Windows (Chrome lo muestra
 * como "CO"). Si la imagen no carga, queda el codigo ISO.
 */
function Bandera({ pais }: { pais: Pais }) {
  return (
    <span className="flex h-[15px] w-5 shrink-0 items-center justify-center overflow-hidden rounded-[2px] bg-surface-hover text-[9px] font-bold text-muted">
      {/* eslint-disable-next-line @next/next/no-img-element -- CDN de banderas, sin optimizar */}
      <img
        src={pais.banderaUrl}
        alt={pais.iso}
        width={20}
        height={15}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
        onError={(e) => {
          e.currentTarget.replaceWith(document.createTextNode(pais.iso));
        }}
      />
    </span>
  );
}
