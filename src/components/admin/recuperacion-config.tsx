"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, KeyRound } from "lucide-react";
import {
  crearPlantillaDeRecuperacion,
  guardarAjusteRecuperacion,
} from "@/app/actions/recuperacion";

export type LineaOpcion = { id: string; etiqueta: string };
export type PlantillaOpcion = { meta_template_name: string; language: string; status: string };

/**
 * Por qué línea y con qué plantilla salen los códigos de recuperación.
 *
 * Va aparte de la plantilla de activación a propósito: esa sale por el WhatsApp
 * de administración, y los códigos deben salir por la línea de soporte.
 */
export function RecuperacionConfigPanel({
  lineas,
  plantillas,
  ajusteInicial,
}: {
  lineas: LineaOpcion[];
  plantillas: PlantillaOpcion[];
  ajusteInicial: { whatsappAccountId: string; templateName: string; language: string } | null;
}) {
  const router = useRouter();
  const [guardando, guardar] = useTransition();
  const [creando, crear] = useTransition();
  const [linea, setLinea] = useState(ajusteInicial?.whatsappAccountId ?? "");
  const [plantilla, setPlantilla] = useState(ajusteInicial?.templateName ?? "");
  const [nombreNuevo, setNombreNuevo] = useState("recuperar_clave");
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<string | null>(null);

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="mb-1 flex items-center gap-2 text-sm font-medium text-foreground">
        <KeyRound size={15} className="text-primary" />
        Recuperación de contraseña por WhatsApp
      </p>
      <p className="mb-4 text-xs text-muted">
        El código de 6 dígitos que recibe el dueño de un espacio cuando olvida su contraseña. Elige una línea
        distinta a la de ventas: los códigos no deberían competir con los envíos masivos por el cupo diario.
      </p>

      <div className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Línea que envía los códigos</label>
          <select
            value={linea}
            onChange={(e) => setLinea(e.target.value)}
            className="w-full rounded-[9px] border border-border bg-background px-2 py-1.5 text-[13px] text-foreground outline-none focus:border-primary"
          >
            <option value="">Sin elegir</option>
            {lineas.map((l) => (
              <option key={l.id} value={l.id}>
                {l.etiqueta}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">
            Plantilla de autenticación (categoría AUTHENTICATION)
          </label>
          <select
            value={plantilla}
            onChange={(e) => setPlantilla(e.target.value)}
            className="w-full rounded-[9px] border border-border bg-background px-2 py-1.5 text-[13px] text-foreground outline-none focus:border-primary"
          >
            <option value="">Sin elegir</option>
            {plantillas.map((p) => (
              <option key={`${p.meta_template_name}-${p.language}`} value={p.meta_template_name}>
                {p.meta_template_name} ({p.status === "APPROVED" ? "aprobada" : p.status.toLowerCase()})
              </option>
            ))}
          </select>
          {plantillas.length === 0 && (
            <p className="mt-1 text-[11px] text-muted">
              Esta línea no tiene plantillas de autenticación. Créala abajo y espera la aprobación de Meta (24-48 h).
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={guardando || !linea || !plantilla}
            onClick={() =>
              guardar(async () => {
                setError(null);
                setListo(null);
                const r = await guardarAjusteRecuperacion({
                  whatsappAccountId: linea,
                  templateName: plantilla,
                  language: "es",
                });
                if (r?.error) setError(r.error);
                else {
                  setListo("Guardado.");
                  router.refresh();
                }
              })
            }
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {guardando ? "Guardando..." : "Guardar"}
          </button>
          {listo && (
            <span className="flex items-center gap-1 text-xs text-success">
              <CheckCircle2 size={13} />
              {listo}
            </span>
          )}
        </div>
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <p className="mb-1 text-xs font-medium text-foreground">Crear la plantilla en Meta</p>
        <p className="mb-2 text-[11px] leading-relaxed text-muted">
          El texto lo fija Meta y no se puede cambiar: <em>&ldquo;123456 es tu código de verificación. Por tu propia
          seguridad, no compartas este código. Este código caduca en 10 minutos.&rdquo;</em> más el botón nativo
          &ldquo;Copiar código&rdquo;.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
            className="rounded-[9px] border border-border bg-background px-2 py-1.5 text-[13px] text-foreground outline-none focus:border-primary"
          />
          <button
            type="button"
            disabled={creando || !linea || !nombreNuevo}
            onClick={() =>
              crear(async () => {
                setError(null);
                setListo(null);
                const r = await crearPlantillaDeRecuperacion(linea, nombreNuevo);
                if (r?.error) setError(r.error);
                else {
                  setListo("Plantilla enviada a Meta. Queda en revisión 24-48 horas.");
                  router.refresh();
                }
              })
            }
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-hover disabled:opacity-50"
          >
            {creando ? "Creando..." : "Crear en Meta"}
          </button>
          {!linea && <span className="text-[11px] text-muted">Elige primero la línea.</span>}
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-xs text-foreground">
          {error}
        </p>
      )}
    </div>
  );
}
