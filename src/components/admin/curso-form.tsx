"use client";

import { useActionState, useState } from "react";
import { Check, ExternalLink, Pencil, Trash2, X } from "lucide-react";
import { actualizarCurso, crearCurso, eliminarCurso, revisarCompra, verComprobante } from "@/app/actions/cursos";
import { Button } from "@/components/ui/button";

export type CursoAdmin = {
  id: string;
  titulo: string;
  descripcion: string | null;
  portada_url: string | null;
  precio_cents: number;
  currency: string;
  datos_transferencia: string | null;
  activo: boolean;
  orden: number;
  lecciones: number;
};

export type CompraAdmin = {
  id: string;
  curso: string;
  espacio: string;
  metodo: string;
  monto_cents: number;
  status: string;
  tiene_comprobante: boolean;
  created_at: string;
};

const INPUT =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary";

function pesos(cents: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(cents / 100);
}

function Campos({ c }: { c?: CursoAdmin }) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-sm font-medium text-muted sm:col-span-2">
          Título del curso
          <input name="titulo" required defaultValue={c?.titulo} className={`${INPUT} mt-1`} placeholder="Ventas por WhatsApp de 0 a 100" />
        </label>
        <label className="text-sm font-medium text-muted">
          Precio (COP)
          <input
            name="precio"
            type="number"
            min={0}
            step={1000}
            required
            defaultValue={c ? Math.round(c.precio_cents / 100) : 0}
            className={`${INPUT} mt-1`}
            placeholder="150000"
          />
        </label>
      </div>
      <label className="text-sm font-medium text-muted">
        Descripción
        <textarea name="descripcion" rows={3} defaultValue={c?.descripcion ?? ""} className={`${INPUT} mt-1`} placeholder="Qué aprende, para quién es, qué incluye" />
      </label>
      <label className="text-sm font-medium text-muted">
        Datos para transferencia (Nequi, banco…)
        <textarea
          name="datosTransferencia"
          rows={2}
          defaultValue={c?.datos_transferencia ?? ""}
          className={`${INPUT} mt-1`}
          placeholder={"Nequi 3166230373 a nombre de…\nBancolombia ahorros 123-456789-00"}
        />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-sm font-medium text-muted sm:col-span-2">
          Portada (imagen)
          <input
            type="file"
            name="portada"
            accept="image/*"
            className="mt-1 block w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-surface-hover file:px-3 file:py-1.5 file:text-sm file:text-foreground"
          />
        </label>
        <label className="text-sm font-medium text-muted">
          Orden
          <input name="orden" type="number" defaultValue={c?.orden ?? 0} className={`${INPUT} mt-1`} />
        </label>
      </div>
      <p className="text-[11px] text-muted">
        Las lecciones son tutoriales: créalos arriba y elige este curso en el campo &quot;Curso&quot;.
      </p>
    </>
  );
}

export function NuevoCursoForm() {
  const [state, action, pending] = useActionState(crearCurso, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <Campos />
      {state && "error" in state && <p className="text-sm text-red-400">{state.error}</p>}
      {state && "success" in state && <p className="text-sm text-success">Curso creado.</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Guardando..." : "Crear curso"}
      </Button>
    </form>
  );
}

export function FilaCurso({ c }: { c: CursoAdmin }) {
  const [editando, setEditando] = useState(false);
  const [state, action, pending] = useActionState(actualizarCurso.bind(null, c.id), undefined);

  if (editando) {
    return (
      <form action={action} className="flex flex-col gap-3 border-b border-border px-5 py-4 last:border-b-0">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Editar curso</p>
          <button type="button" onClick={() => setEditando(false)} aria-label="Cerrar" className="text-muted hover:text-foreground">
            <X size={15} />
          </button>
        </div>
        <Campos c={c} />
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" name="activo" defaultChecked={c.activo} /> Visible para los clientes
        </label>
        {state && "error" in state && <p className="text-sm text-red-400">{state.error}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando..." : "Guardar"}
          </Button>
          <button type="button" onClick={() => setEditando(false)} className="text-sm text-muted hover:text-foreground">
            Cancelar
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-4 border-b border-border px-5 py-3 last:border-b-0">
      {c.portada_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.portada_url} alt="" className="h-10 w-16 shrink-0 rounded-md object-cover" />
      ) : (
        <span className="h-10 w-16 shrink-0 rounded-md bg-surface-hover" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {c.titulo}
          {!c.activo && <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted">Oculto</span>}
        </p>
        <p className="truncate text-xs text-muted">
          {pesos(c.precio_cents)} · {c.lecciones} {c.lecciones === 1 ? "lección" : "lecciones"}
        </p>
      </div>
      <button type="button" onClick={() => setEditando(true)} className="text-muted hover:text-foreground" title="Editar">
        <Pencil size={14} />
      </button>
      <button
        type="button"
        onClick={() => {
          if (confirm(`¿Eliminar el curso "${c.titulo}"? Sus lecciones quedarán como videos sueltos.`)) void eliminarCurso(c.id);
        }}
        className="text-muted hover:text-error"
        title="Eliminar"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export function FilaCompra({ c }: { c: CompraAdmin }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function abrirComprobante() {
    const r = await verComprobante(c.id);
    if ("error" in r) {
      setError(r.error ?? "No se pudo abrir.");
      return;
    }
    window.open(r.url, "_blank", "noopener,noreferrer");
  }

  async function revisar(aprobar: boolean) {
    setPending(true);
    setError(null);
    const r = await revisarCompra(c.id, aprobar);
    setPending(false);
    if (r && "error" in r) setError(r.error ?? "No se pudo guardar.");
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {c.espacio} · <span className="text-muted">{c.curso}</span>
        </p>
        <p className="text-xs text-muted">
          {pesos(c.monto_cents)} · {c.metodo === "bold" ? "Pasarela" : "Transferencia"} ·{" "}
          {new Date(c.created_at).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
        </p>
        {error && <p className="text-xs text-error">{error}</p>}
      </div>
      {c.tiene_comprobante && (
        <button type="button" onClick={abrirComprobante} className="flex items-center gap-1 text-xs text-primary hover:underline">
          <ExternalLink size={12} /> Ver comprobante
        </button>
      )}
      {c.status === "pending" ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => revisar(true)}
            disabled={pending}
            className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-hover disabled:opacity-50"
          >
            <Check size={12} /> Aprobar
          </button>
          <button
            type="button"
            onClick={() => revisar(false)}
            disabled={pending}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:border-error hover:text-error disabled:opacity-50"
          >
            Rechazar
          </button>
        </div>
      ) : (
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
            c.status === "approved" ? "bg-success/15 text-success" : "border border-border text-muted"
          }`}
        >
          {c.status === "approved" ? "Aprobada" : "Rechazada"}
        </span>
      )}
    </div>
  );
}
