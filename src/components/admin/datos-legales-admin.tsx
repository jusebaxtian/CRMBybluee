"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { corregirDatosLegales } from "@/app/actions/soporte";
import { TIPOS_DE_DOCUMENTO } from "@/lib/soporte/documento";

const INPUT =
  "w-full min-w-0 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary";

/**
 * Datos legales de un cliente, en su ficha del Admin.
 *
 * El cliente los registra una vez y ya no puede cambiarlos. Esta es la salida
 * cuando se equivoca (o cuando pide que se los cargues): solo un administrador
 * de la plataforma puede editarlos.
 */
export function DatosLegalesAdmin({
  workspaceId,
  inicial,
  registrados,
}: {
  workspaceId: string;
  inicial: { razonSocial: string; tipo: string; numero: string; direccion: string };
  /** El cliente ya los registro (o alguien los cargo): estan bloqueados para el. */
  registrados: boolean;
}) {
  const router = useRouter();
  const [razonSocial, setRazonSocial] = useState(inicial.razonSocial);
  const [tipo, setTipo] = useState(inicial.tipo || "NIT");
  const [numero, setNumero] = useState(inicial.numero);
  const [direccion, setDireccion] = useState(inicial.direccion);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [guardando, guardar] = useTransition();

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="mb-3 flex items-center gap-2">
        <p className="text-sm font-medium text-foreground">Datos legales</p>
        {registrados ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
            <Lock size={10} /> Bloqueados para el cliente
          </span>
        ) : (
          <span className="rounded-full border border-warning px-2 py-0.5 text-[11px] text-warning">Sin registrar</span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-muted sm:col-span-2">
          Nombre o razón social
          <input value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} maxLength={120} className={INPUT} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Tipo de documento
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={INPUT}>
            {TIPOS_DE_DOCUMENTO.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Número
          <input value={numero} onChange={(e) => setNumero(e.target.value)} maxLength={24} className={INPUT} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted sm:col-span-2">
          Dirección
          <input value={direccion} onChange={(e) => setDireccion(e.target.value)} maxLength={160} className={INPUT} />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          disabled={guardando}
          onClick={() =>
            guardar(async () => {
              setMensaje(null);
              const r = await corregirDatosLegales(workspaceId, { razonSocial, tipo, numero, direccion });
              if ("error" in r && r.error) {
                setMensaje({ ok: false, texto: r.error });
                return;
              }
              setMensaje({ ok: true, texto: "Guardado." });
              router.refresh();
            })
          }
          className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {guardando ? "Guardando…" : registrados ? "Corregir datos" : "Cargar datos"}
        </button>
        {mensaje && <span className={`text-xs ${mensaje.ok ? "text-success" : "text-red-400"}`}>{mensaje.texto}</span>}
      </div>
    </div>
  );
}
