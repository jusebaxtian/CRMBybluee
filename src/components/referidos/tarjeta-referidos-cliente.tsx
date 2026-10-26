"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Gift, Share2 } from "lucide-react";
import { canjearMesReferido } from "@/app/actions/referidos";
import { casillasDeReferidos, enlaceDeReferido, TOPE_REFERIDOS, type CasillaDeReferido } from "@/lib/referidos/estado";

const ESTILO: Record<CasillaDeReferido, string> = {
  usado: "border-dash-green bg-dash-green text-white",
  disponible: "border-dash-green bg-dash-green-13 text-dash-green-text",
  en_revision: "border-dash-amber bg-[rgba(234,179,8,0.13)] text-dash-amber",
  libre: "border-dash-border bg-transparent text-dash-text-2",
};

export function TarjetaReferidosCliente({
  codigo,
  usados,
  disponibles,
  enRevision,
  puedeCanjear,
}: {
  codigo: string;
  usados: number;
  disponibles: number;
  enRevision: number;
  puedeCanjear: boolean;
}) {
  const enlace = enlaceDeReferido(codigo);
  const [copiado, setCopiado] = useState(false);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, empezar] = useTransition();
  const casillas = casillasDeReferidos({ usados, disponibles, enRevision });
  const ganados = usados + disponibles;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setMensaje({ ok: false, texto: "No se pudo copiar. Selecciona el enlace y cópialo." });
    }
  }

  const textoWhatsApp = `Te recomiendo CRM Bybluee para vender por WhatsApp con la API oficial. Regístrate con mi enlace: ${enlace}`;

  return (
    <section
      aria-label="Invita a un amigo"
      className="flex w-full flex-col gap-3 rounded-[13px] border border-dash-border bg-dash-card p-[16px] lg:w-[400px]"
    >
      <div className="flex items-start gap-2.5">
        <span aria-hidden className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-dash-green-13 text-dash-green-text">
          <Gift size={17} />
        </span>
        <div>
          <p className="font-dash-display text-[14.5px] font-bold text-dash-text">Invita a un amigo, gana 1 mes gratis</p>
          <p className="mt-0.5 text-[12px] leading-snug text-dash-text-2">
            Cuando tu amigo active su licencia con tu enlace, ganas un mes. Hasta {TOPE_REFERIDOS} meses.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          readOnly
          value={enlace}
          aria-label="Tu enlace personal"
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 truncate rounded-[9px] border border-dash-border bg-transparent px-2.5 py-1.5 font-dash-ui text-[12px] text-dash-text"
        />
        <button
          type="button"
          onClick={copiar}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-[9px] border border-dash-border px-2.5 text-[12px] font-semibold text-dash-text hover:bg-dash-green-13"
        >
          {copiado ? <Check size={14} /> : <Copy size={14} />}
          {copiado ? "Copiado" : "Copiar"}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(textoWhatsApp)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Compartir por WhatsApp"
          title="Compartir por WhatsApp"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-dash-border text-dash-text hover:bg-dash-green-13"
        >
          <Share2 size={14} />
        </a>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5" aria-label={`${ganados} de ${TOPE_REFERIDOS} meses ganados`}>
          {casillas.map((c, i) => (
            <span
              key={i}
              title={c === "usado" ? "Mes usado" : c === "disponible" ? "Mes disponible" : c === "en_revision" ? "En revisión" : "Disponible para ganar"}
              className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-bold ${ESTILO[c]}`}
            >
              {c === "libre" ? i + 1 : c === "en_revision" ? "…" : "✓"}
            </span>
          ))}
          <span className="ml-1 text-[12px] text-dash-text-2">
            {ganados} de {TOPE_REFERIDOS}
          </span>
        </div>

        {disponibles > 0 && puedeCanjear && (
          <button
            type="button"
            disabled={pendiente}
            onClick={() =>
              empezar(async () => {
                setMensaje(null);
                const r = await canjearMesReferido();
                if ("error" in r) setMensaje({ ok: false, texto: r.error });
                else
                  setMensaje({
                    ok: true,
                    texto: `Listo. Tu plan quedó vigente hasta el ${new Date(r.hasta).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Bogota" })}.`,
                  });
              })
            }
            className="rounded-[9px] bg-dash-green px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-60"
          >
            {pendiente ? "Aplicando…" : `Usar 1 mes gratis (${disponibles})`}
          </button>
        )}
      </div>

      {enRevision > 0 && (
        <p className="text-[11.5px] text-dash-amber">
          {enRevision === 1 ? "Un referido está" : `${enRevision} referidos están`} en revisión; te avisamos cuando se apruebe.
        </p>
      )}
      {mensaje && <p className={`text-[12px] ${mensaje.ok ? "text-dash-green-text" : "text-dash-red"}`}>{mensaje.texto}</p>}
    </section>
  );
}
