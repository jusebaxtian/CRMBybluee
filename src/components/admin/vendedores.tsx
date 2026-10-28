"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actualizarVendedor, cambiarEstadoVenta, convertirEnVendedor, crearVendedor } from "@/app/actions/vendedores";
import type { EstadoVenta } from "@/lib/vendedores/comision";

const INPUT =
  "w-full rounded-[9px] border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary";
const BOTON = "rounded-[9px] bg-primary px-3 py-2 text-[13px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50";

/** Formulario: vendedor nuevo (usuario nuevo como asesor de tu espacio). */
export function FormNuevoVendedor() {
  const [estado, accion, pendiente] = useActionState(crearVendedor, undefined);
  return (
    <form action={accion} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <input name="nombre" placeholder="Nombre" className={INPUT} required />
      <input name="correo" type="email" placeholder="Correo" className={INPUT} required />
      <input name="clave" type="password" placeholder="Contraseña (mín. 8)" className={INPUT} minLength={8} required />
      <input name="pct" inputMode="decimal" placeholder="Comisión %" defaultValue="20" className={INPUT} required />
      <button type="submit" disabled={pendiente} className={BOTON}>
        {pendiente ? "Creando…" : "Crear vendedor"}
      </button>
      {estado && "error" in estado && <p className="text-xs text-red-400 sm:col-span-2 lg:col-span-5">{estado.error}</p>}
      {estado && "success" in estado && (
        <p className="text-xs text-success sm:col-span-2 lg:col-span-5">
          Vendedor creado. Ya puede entrar con su correo y contraseña; asígnale chats para que venda.
        </p>
      )}
    </form>
  );
}

/** Convertir un asesor que ya existe en tu espacio en vendedor. */
export function ConvertirAsesor({ asesores }: { asesores: { id: string; nombre: string }[] }) {
  const router = useRouter();
  const [userId, setUserId] = useState(asesores[0]?.id ?? "");
  const [pct, setPct] = useState("20");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  if (!asesores.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select value={userId} onChange={(e) => setUserId(e.target.value)} className={`${INPUT} w-auto`}>
        {asesores.map((a) => (
          <option key={a.id} value={a.id}>
            {a.nombre}
          </option>
        ))}
      </select>
      <input value={pct} onChange={(e) => setPct(e.target.value)} inputMode="decimal" className={`${INPUT} w-24`} aria-label="Comisión %" />
      <button
        type="button"
        disabled={pendiente || !userId}
        className={BOTON}
        onClick={() =>
          empezar(async () => {
            const r = await convertirEnVendedor(userId, pct);
            setMensaje(r.error ?? "Listo: ahora es vendedor.");
            router.refresh();
          })
        }
      >
        Convertir en vendedor
      </button>
      {mensaje && <span className="text-xs text-muted">{mensaje}</span>}
    </div>
  );
}

/** Porcentaje y activo/inactivo de un vendedor. */
export function EditarVendedor({ userId, pct, activo }: { userId: string; pct: number; activo: boolean }) {
  const router = useRouter();
  const [valor, setValor] = useState(String(pct));
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const guardar = (cambios: { pct?: string; activo?: boolean }) =>
    empezar(async () => {
      setError(null);
      const r = await actualizarVendedor(userId, cambios);
      setError(r.error ?? null);
      router.refresh();
    });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" className={`${INPUT} w-20 py-1`} aria-label="Comisión %" />
      <span className="text-xs text-muted">%</span>
      {valor !== String(pct) && (
        <button type="button" disabled={pendiente} onClick={() => guardar({ pct: valor })} className="text-xs font-semibold text-primary">
          Guardar
        </button>
      )}
      <button
        type="button"
        disabled={pendiente}
        onClick={() => guardar({ activo: !activo })}
        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${activo ? "bg-success/15 text-success" : "bg-border text-muted"}`}
        title={activo ? "Desactivar: deja de poder registrar ventas" : "Activar"}
      >
        {activo ? "Activo" : "Inactivo"}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}

/** Botones de una venta segun su estado. */
export function AccionesVenta({ ventaId, estado }: { ventaId: string; estado: EstadoVenta }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const cambiar = (hacia: EstadoVenta) =>
    empezar(async () => {
      setError(null);
      let nota: string | undefined;
      if (hacia === "pagada") nota = window.prompt("Referencia del pago al vendedor (opcional):") ?? undefined;
      if (hacia === "anulada") {
        const motivo = window.prompt("¿Por qué se anula? (devolución, comprobante falso...)");
        if (motivo === null) return;
        nota = motivo;
      }
      const r = await cambiarEstadoVenta(ventaId, hacia, nota);
      setError(r.error ?? null);
      router.refresh();
    });

  if (estado === "pagada" || estado === "anulada") return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {estado === "pendiente" && (
        <button type="button" disabled={pendiente} onClick={() => cambiar("aprobada")} className="rounded-md bg-success/15 px-2 py-1 text-xs font-semibold text-success">
          Aprobar
        </button>
      )}
      {estado === "aprobada" && (
        <button type="button" disabled={pendiente} onClick={() => cambiar("pagada")} className="rounded-md bg-primary/15 px-2 py-1 text-xs font-semibold text-primary">
          Marcar pagada
        </button>
      )}
      <button type="button" disabled={pendiente} onClick={() => cambiar("anulada")} className="rounded-md bg-error/15 px-2 py-1 text-xs font-semibold text-error">
        Anular
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
