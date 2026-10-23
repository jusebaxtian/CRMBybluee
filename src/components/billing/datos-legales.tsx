"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, AlertTriangle } from "lucide-react";
import { guardarDatosLegales } from "@/app/actions/soporte";
import { TIPOS_DE_DOCUMENTO } from "@/lib/soporte/documento";

export type DatosLegalesGuardados = {
  razonSocial: string;
  documentoTipo: string;
  documentoNumero: string;
  direccion: string;
};

const campo =
  "w-full rounded-[9px] border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary";
const soloLectura =
  "w-full cursor-not-allowed rounded-[9px] border border-border bg-surface-hover px-3 py-2 text-[13px] text-muted";

/**
 * Datos legales de la empresa, que salen impresos en cada soporte de compra.
 *
 * Se registran una sola vez. Antes de guardar se avisa, con todas sus letras,
 * que despues no se pueden cambiar, y se pide marcar que se revisaron: un dato
 * mal escrito en un documento contable no se puede corregir desde aqui. El
 * correo y el telefono se muestran ya llenos, tomados de la cuenta, y no se
 * editan en este formulario.
 */
export function DatosLegales({
  guardados,
  correo,
  telefono,
  puedeRegistrar,
}: {
  guardados: DatosLegalesGuardados | null;
  correo: string | null;
  telefono: string | null;
  puedeRegistrar: boolean;
}) {
  const router = useRouter();
  const [razonSocial, setRazonSocial] = useState("");
  const [tipo, setTipo] = useState("NIT");
  const [numero, setNumero] = useState("");
  const [direccion, setDireccion] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, guardar] = useTransition();

  const etiquetaTipo = (v: string) => TIPOS_DE_DOCUMENTO.find((t) => t.valor === v)?.etiqueta ?? v;

  // ---- Ya registrados: se muestran, bloqueados ----------------------------
  if (guardados) {
    const filas: [string, string][] = [
      ["Nombre o razón social", guardados.razonSocial],
      [etiquetaTipo(guardados.documentoTipo).split(" (")[0], guardados.documentoNumero],
      ["Dirección", guardados.direccion],
      ["Correo", correo ?? "—"],
      ["Teléfono", telefono ?? "—"],
    ];
    return (
      <section id="datos-legales" className="rounded-[13px] border border-border bg-surface p-5">
        <div className="mb-3 flex items-center gap-2">
          <Lock size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Datos legales de tu empresa</h2>
        </div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          {filas.map(([k, v]) => (
            <div key={k} className="flex flex-col">
              <dt className="text-[11px] text-muted">{k}</dt>
              <dd className="text-sm text-foreground">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-muted">
          Estos datos están registrados y <b>no se pueden editar</b>. Salen en tus soportes de compra. Si hay un error,
          escríbenos a soporte y lo corregimos.
        </p>
      </section>
    );
  }

  // ---- Sin registrar, y quien mira no es el dueño --------------------------
  if (!puedeRegistrar) {
    return (
      <section id="datos-legales" className="rounded-[13px] border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold text-foreground">Datos legales de tu empresa</h2>
        <p className="mt-1 text-sm text-muted">
          Todavía no están registrados. El dueño de la cuenta debe registrarlos para poder descargar los soportes de
          compra.
        </p>
      </section>
    );
  }

  // ---- Formulario ------------------------------------------------------------
  return (
    <section id="datos-legales" className="rounded-[13px] border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold text-foreground">Datos legales de tu empresa</h2>
      <p className="mt-1 text-sm text-muted">
        Completa estos datos para descargar los soportes de tus compras. Salen impresos en el documento.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted sm:col-span-2">
          Nombre o razón social
          <input
            value={razonSocial}
            onChange={(e) => setRazonSocial(e.target.value)}
            maxLength={120}
            placeholder="Como aparece en tu RUT o cédula"
            className={campo}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Tipo de documento
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={campo}>
            {TIPOS_DE_DOCUMENTO.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Número
          <input
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            maxLength={24}
            placeholder={tipo === "NIT" ? "900.123.456-7" : "Número de documento"}
            className={campo}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted sm:col-span-2">
          Dirección
          <input
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            maxLength={160}
            placeholder="Calle, número, ciudad"
            className={campo}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Correo (de tu cuenta)
          <input value={correo ?? ""} readOnly tabIndex={-1} aria-readonly className={soloLectura} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Teléfono (de tu cuenta)
          <input value={telefono ?? ""} readOnly tabIndex={-1} aria-readonly className={soloLectura} />
        </label>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-[10px] border border-warning/40 bg-warning/10 p-3">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning" />
        <p className="text-xs leading-relaxed text-foreground">
          <b>Una vez guardados, estos datos no se pueden editar.</b> Salen en tus soportes de compra y no podrás
          cambiarlos tú. Revisa bien cada uno antes de continuar.
        </p>
      </div>

      <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-foreground">
        <input
          type="checkbox"
          checked={confirmado}
          onChange={(e) => setConfirmado(e.target.checked)}
          className="mt-0.5 accent-primary"
        />
        Revisé los datos y entiendo que no podré editarlos después.
      </label>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <button
        type="button"
        disabled={!confirmado || guardando}
        onClick={() =>
          guardar(async () => {
            setError(null);
            const r = await guardarDatosLegales({ razonSocial, tipo, numero, direccion });
            if ("error" in r && r.error) {
              setError(r.error);
              return;
            }
            router.refresh();
          })
        }
        className="mt-3 rounded-[9px] bg-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {guardando ? "Guardando…" : "Guardar datos legales"}
      </button>
    </section>
  );
}
