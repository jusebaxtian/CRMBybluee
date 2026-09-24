"use client";

import { useActionState, useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { actualizarTutorial, crearTutorial, eliminarTutorial } from "@/app/actions/tutoriales";
import { Button } from "@/components/ui/button";
import { MODULOS_TUTORIAL, etiquetaModulo, idYoutube } from "@/lib/tutoriales/video";

export type CursoOpcion = { id: string; titulo: string };

export type TutorialAdmin = {
  id: string;
  curso_id: string | null;
  titulo: string;
  descripcion: string | null;
  url: string;
  modulo: string;
  duracion: string | null;
  orden: number;
  activo: boolean;
};

const INPUT =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary";

function Campos({ t, cursos }: { t?: TutorialAdmin; cursos: CursoOpcion[] }) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-muted">
          Título
          <input name="titulo" required defaultValue={t?.titulo} className={`${INPUT} mt-1`} placeholder="Conecta tu WhatsApp" />
        </label>
        <label className="text-sm font-medium text-muted">
          URL del video
          <input name="url" type="url" required defaultValue={t?.url} className={`${INPUT} mt-1`} placeholder="https://www.youtube.com/watch?v=…" />
        </label>
      </div>
      <label className="text-sm font-medium text-muted">
        Descripción (opcional)
        <input name="descripcion" defaultValue={t?.descripcion ?? ""} className={`${INPUT} mt-1`} placeholder="Qué aprende el cliente en este video" />
      </label>
      <div className="grid grid-cols-3 gap-3">
        <label className="text-sm font-medium text-muted">
          Módulo
          <select name="modulo" defaultValue={t?.modulo ?? "empezar"} className={`${INPUT} mt-1`}>
            {MODULOS_TUTORIAL.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-muted">
          Duración
          <input name="duracion" defaultValue={t?.duracion ?? ""} className={`${INPUT} mt-1`} placeholder="2:10" />
        </label>
        <label className="text-sm font-medium text-muted">
          Orden
          <input name="orden" type="number" defaultValue={t?.orden ?? 0} className={`${INPUT} mt-1`} />
        </label>
      </div>
      {cursos.length > 0 && (
        <label className="text-sm font-medium text-muted">
          ¿Pertenece a un curso?
          <select name="cursoId" defaultValue={t?.curso_id ?? ""} className={`${INPUT} mt-1`}>
            <option value="">No — video gratuito para todos</option>
            {cursos.map((c) => (
              <option key={c.id} value={c.id}>
                Lección del curso: {c.titulo}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="text-[11px] text-muted">
        YouTube (incluidos videos &quot;no listados&quot;) se reproduce dentro de la plataforma; cualquier otra URL abre en una pestaña nueva.
      </p>
    </>
  );
}

export function NuevoTutorialForm({ cursos = [] }: { cursos?: CursoOpcion[] }) {
  const [state, action, pending] = useActionState(crearTutorial, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <Campos cursos={cursos} />
      {state && "error" in state && <p className="text-sm text-red-400">{state.error}</p>}
      {state && "success" in state && <p className="text-sm text-success">Tutorial agregado.</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Guardando..." : "Agregar tutorial"}
      </Button>
    </form>
  );
}

export function FilaTutorial({ t, cursos = [] }: { t: TutorialAdmin; cursos?: CursoOpcion[] }) {
  const [editando, setEditando] = useState(false);
  const [state, action, pending] = useActionState(actualizarTutorial.bind(null, t.id), undefined);
  const yt = idYoutube(t.url);

  if (editando) {
    return (
      <form action={action} className="flex flex-col gap-3 border-b border-border px-5 py-4 last:border-b-0">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Editar tutorial</p>
          <button type="button" onClick={() => setEditando(false)} className="text-muted hover:text-foreground" aria-label="Cerrar">
            <X size={15} />
          </button>
        </div>
        <Campos t={t} cursos={cursos} />
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" name="activo" defaultChecked={t.activo} /> Visible para los clientes
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
      <span className="text-xs text-muted">{t.orden}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {t.titulo}
          {!t.activo && <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted">Oculto</span>}
        </p>
        <p className="truncate text-xs text-muted">
          {etiquetaModulo(t.modulo)} · {t.duracion ?? "—"} · {yt ? "YouTube embebido" : "Enlace externo"} ·{" "}
          <a href={t.url} target="_blank" rel="noopener noreferrer" className="underline">
            ver
          </a>
        </p>
      </div>
      <button type="button" onClick={() => setEditando(true)} className="text-muted hover:text-foreground" title="Editar">
        <Pencil size={14} />
      </button>
      <button
        type="button"
        onClick={() => {
          if (confirm(`¿Eliminar "${t.titulo}"?`)) void eliminarTutorial(t.id);
        }}
        className="text-muted hover:text-error"
        title="Eliminar"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
