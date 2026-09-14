"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { GripVertical, Loader2 } from "lucide-react";
import { reorderTags, cargarMasContactosDeEtiqueta } from "@/app/actions/tags";
import type { ContactoEtiqueta } from "@/lib/dashboard/datos";

export type ColumnaEtiqueta = {
  id: string;
  nombre: string;
  color: string;
  total: number;
  contactos: ContactoEtiqueta[];
};

/**
 * Tablero horizontal de etiquetas, con el mismo lenguaje visual que
 * "Pendientes de responder": una columna por etiqueta (nombre, total, % del
 * total de contactos), 5 contactos con su ultimo mensaje y "Ver mas" que trae
 * el resto por tandas. Las columnas se arrastran para reordenarlas; el orden
 * se guarda en tags.position, el mismo que usa el modulo de etiquetas.
 */
export function TableroEtiquetas({
  columnas,
  totalContactos,
  creadoDesde,
  creadoHasta,
  creadoDesdeIso,
  creadoHastaIso,
  porColumna,
}: {
  columnas: ColumnaEtiqueta[];
  totalContactos: number;
  creadoDesde: string | null;
  creadoHasta: string | null;
  creadoDesdeIso: string | null;
  creadoHastaIso: string | null;
  porColumna: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [orden, setOrden] = useState(columnas);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [desde, setDesde] = useState(creadoDesde ?? "");
  const [hasta, setHasta] = useState(creadoHasta ?? "");

  // El filtro de fechas vuelve a pedir los datos al servidor y llega un
  // `columnas` nuevo: se adopta en vez de quedarse con el primer render
  // (patron "reiniciar estado cuando cambia una prop", sin efecto).
  const [columnasPrevias, setColumnasPrevias] = useState(columnas);
  if (columnas !== columnasPrevias) {
    setColumnasPrevias(columnas);
    setOrden(columnas);
  }

  function aplicarFechas(nuevoDesde: string, nuevoHasta: string) {
    const qs = new URLSearchParams(searchParams.toString());
    if (nuevoDesde) qs.set("tagsFrom", nuevoDesde);
    else qs.delete("tagsFrom");
    if (nuevoHasta) qs.set("tagsTo", nuevoHasta);
    else qs.delete("tagsTo");
    startTransition(() => {
      router.push(`${pathname}${qs.toString() ? `?${qs.toString()}` : ""}`, { scroll: false });
    });
  }

  function atajo(dias: number | "mes") {
    const fin = new Date();
    const inicio = dias === "mes" ? new Date(fin.getFullYear(), fin.getMonth(), 1) : new Date(fin);
    if (dias !== "mes") inicio.setDate(inicio.getDate() - dias);
    const f = (d: Date) => d.toISOString().slice(0, 10);
    setDesde(f(inicio));
    setHasta(f(fin));
    aplicarFechas(f(inicio), f(fin));
  }

  function soltar(destinoId: string) {
    if (!arrastrando || arrastrando === destinoId) return;
    setOrden((prev) => {
      const de = prev.findIndex((c) => c.id === arrastrando);
      const a = prev.findIndex((c) => c.id === destinoId);
      if (de === -1 || a === -1) return prev;
      const next = [...prev];
      const [movida] = next.splice(de, 1);
      next.splice(a, 0, movida);
      setGuardando(true);
      reorderTags(next.map((c) => c.id)).finally(() => setGuardando(false));
      return next;
    });
    setArrastrando(null);
  }

  const hayFiltro = !!(desde || hasta);

  return (
    <section
      aria-label="Etiquetas"
      className="flex flex-col gap-[14px] rounded-[13px] border border-dash-border bg-dash-card p-5"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-dash-ui text-[15px] font-semibold text-dash-text">Etiquetas</h2>
          <p className="font-dash-ui text-[12px] text-dash-text-2">
            {totalContactos.toLocaleString("es-CO")} contactos{hayFiltro ? " creados en el rango" : ""} ·{" "}
            {guardando ? "Guardando orden…" : isPending ? "Actualizando…" : "Arrastra una columna para reordenar"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <input
            type="date"
            aria-label="Creados desde"
            value={desde}
            onChange={(e) => {
              setDesde(e.target.value);
              aplicarFechas(e.target.value, hasta);
            }}
            className="rounded-[9px] border border-dash-border bg-dash-bg px-2 py-1.5 font-dash-ui text-[12px] text-dash-text outline-none focus:border-primary"
          />
          <span className="font-dash-ui text-[12px] text-dash-text-3">a</span>
          <input
            type="date"
            aria-label="Creados hasta"
            value={hasta}
            onChange={(e) => {
              setHasta(e.target.value);
              aplicarFechas(desde, e.target.value);
            }}
            className="rounded-[9px] border border-dash-border bg-dash-bg px-2 py-1.5 font-dash-ui text-[12px] text-dash-text outline-none focus:border-primary"
          />
          <button type="button" onClick={() => atajo(6)} className={ATAJO}>
            7 días
          </button>
          <button type="button" onClick={() => atajo("mes")} className={ATAJO}>
            Este mes
          </button>
          {hayFiltro && (
            <button
              type="button"
              onClick={() => {
                setDesde("");
                setHasta("");
                aplicarFechas("", "");
              }}
              className={ATAJO}
            >
              Limpiar
            </button>
          )}
        </div>
      </header>

      {orden.length === 0 ? (
        <p className="flex items-center justify-center py-8 font-dash-ui text-[13px] text-dash-text-3">
          Todavía no tienes etiquetas creadas.
        </p>
      ) : (
        <div className={`-mx-1 overflow-x-auto px-1 pb-2 ${isPending ? "opacity-60 transition-opacity" : "transition-opacity"}`}>
          <div className="flex min-w-max items-start gap-3">
            {orden.map((col) => (
              <Columna
                key={col.id}
                columna={col}
                totalContactos={totalContactos}
                porColumna={porColumna}
                creadoDesdeIso={creadoDesdeIso}
                creadoHastaIso={creadoHastaIso}
                arrastrando={arrastrando === col.id}
                onDragStart={() => setArrastrando(col.id)}
                onDrop={() => soltar(col.id)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

const ATAJO =
  "rounded-full border border-dash-border px-2.5 py-1 font-dash-ui text-[11.5px] font-medium text-dash-text-2 transition-colors hover:border-primary hover:text-dash-green-text";

function Columna({
  columna,
  totalContactos,
  porColumna,
  creadoDesdeIso,
  creadoHastaIso,
  arrastrando,
  onDragStart,
  onDrop,
}: {
  columna: ColumnaEtiqueta;
  totalContactos: number;
  porColumna: number;
  creadoDesdeIso: string | null;
  creadoHastaIso: string | null;
  arrastrando: boolean;
  onDragStart: () => void;
  onDrop: () => void;
}) {
  const [contactos, setContactos] = useState(columna.contactos);
  const [abierta, setAbierta] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [contactosPrevios, setContactosPrevios] = useState(columna.contactos);
  if (columna.contactos !== contactosPrevios) {
    setContactosPrevios(columna.contactos);
    setContactos(columna.contactos);
    setAbierta(false);
  }

  const porcentaje = totalContactos > 0 ? (columna.total / totalContactos) * 100 : 0;
  const faltan = columna.total - contactos.length;
  const visibles = abierta ? contactos : contactos.slice(0, porColumna);

  async function verMas() {
    setAbierta(true);
    if (faltan <= 0 || cargando) return;
    setCargando(true);
    setError(null);
    const r = await cargarMasContactosDeEtiqueta({
      tagId: columna.id,
      desde: contactos.length,
      creadoDesde: creadoDesdeIso,
      creadoHasta: creadoHastaIso,
    });
    setCargando(false);
    if ("error" in r) {
      setError("No se pudieron cargar más contactos.");
      return;
    }
    setContactos((prev) => {
      const ids = new Set(prev.map((c) => c.id));
      return [...prev, ...r.contactos.filter((c) => !ids.has(c.id))];
    });
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className={`flex w-[272px] shrink-0 flex-col gap-[10px] rounded-[12px] border border-dash-border-soft bg-dash-bg p-3 transition-opacity ${
        arrastrando ? "opacity-40" : ""
      }`}
    >
      <header className="flex items-start gap-2">
        <span className="mt-0.5 cursor-grab text-dash-text-3 active:cursor-grabbing" title="Arrastrar para reordenar">
          <GripVertical size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-dash-ui text-[13.5px] font-semibold text-dash-text">
            <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: columna.color }} />
            <span className="truncate">{columna.nombre}</span>
          </p>
          <p className="mt-0.5 font-dash-ui text-[11.5px] text-dash-text-2">
            <span className="font-semibold text-dash-text">{columna.total.toLocaleString("es-CO")}</span>{" "}
            {columna.total === 1 ? "contacto" : "contactos"} · {porcentaje.toFixed(1)} %
          </p>
          <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-dash-track">
            <span className="block h-full rounded-full" style={{ width: `${porcentaje}%`, backgroundColor: columna.color }} />
          </span>
        </div>
      </header>

      {contactos.length === 0 ? (
        <p className="py-4 text-center font-dash-ui text-[12px] text-dash-text-3">Sin contactos</p>
      ) : (
        <ul className={`flex flex-col gap-2 ${abierta ? "max-h-[420px] overflow-y-auto pr-0.5" : ""}`}>
          {visibles.map((c) => {
            const contenido = (
              <>
                <span
                  aria-hidden
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(255,255,255,0.08)] font-dash-ui text-[13px] font-semibold text-dash-text"
                >
                  {c.inicial}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-dash-ui text-[13px] font-semibold text-dash-text">{c.nombre}</span>
                  <span className="block truncate font-dash-ui text-[11.5px] text-dash-text-3">
                    {c.contexto}
                    {c.hace ? ` · ${c.hace}` : ""}
                  </span>
                </span>
                {c.sinResponder && (
                  <span aria-label="Sin responder" className="h-2 w-2 shrink-0 rounded-full bg-dash-green" />
                )}
              </>
            );
            const clases =
              "flex items-center gap-3 rounded-[10px] border border-dash-border-soft bg-dash-card px-3 py-[10px] transition-colors duration-150 hover:bg-dash-surface-subtle";
            return (
              <li key={c.id}>
                {c.conversacionId ? (
                  <Link href={`/dashboard/inbox/${c.conversacionId}`} className={clases}>
                    {contenido}
                  </Link>
                ) : (
                  <Link href="/dashboard/contacts" className={clases}>
                    {contenido}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {error && <p className="font-dash-ui text-[11.5px] text-dash-red">{error}</p>}

      {columna.total > porColumna && (
        <button
          type="button"
          onClick={() => (abierta && faltan <= 0 ? setAbierta(false) : void verMas())}
          disabled={cargando}
          className="flex items-center justify-center gap-1.5 rounded-[9px] border border-dash-border py-[7px] font-dash-ui text-[12px] font-semibold text-dash-green-text transition-colors hover:bg-dash-green-7 disabled:opacity-60"
        >
          {cargando && <Loader2 size={13} className="animate-spin" />}
          {cargando
            ? "Cargando…"
            : abierta
              ? faltan > 0
                ? `Ver ${Math.min(faltan, 20)} más`
                : "Ver menos"
              : `Ver más (${columna.total - porColumna})`}
        </button>
      )}
    </div>
  );
}
