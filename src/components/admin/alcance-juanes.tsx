"use client";

import { useState, useTransition } from "react";
import { guardarAlcanceDelVendedor } from "@/app/actions/agente-vendedor";

/**
 * Donde responde el agente vendedor (0188): en que lineas y en los chats de que
 * asesores. Lo que queda fuera lo sigue atendiendo el agente de IA de la linea,
 * si lo tiene. Los numeros de prueba reciben respuesta siempre.
 */

type Linea = { id: string; nombre: string };
type Asesor = { id: string; nombre: string };

export const SIN_ASIGNAR = "sin_asignar";

function Casilla({ marcada, onChange, children }: { marcada: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-2.5 py-2 text-[13px] text-foreground hover:bg-surface-hover">
      <input type="checkbox" checked={marcada} onChange={onChange} className="h-4 w-4 accent-[var(--primary)]" />
      <span className="min-w-0 truncate">{children}</span>
    </label>
  );
}

function Opcion({ activa, onClick, children }: { activa: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        activa ? "border-primary bg-primary/15 text-primary" : "border-border text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

export function AlcanceJuanes({
  nombre,
  lineas,
  asesores,
  inicial,
}: {
  nombre: string;
  lineas: Linea[];
  asesores: Asesor[];
  inicial: { lineasModo: string; lineasIds: string[]; asesoresModo: string; asesoresIds: string[] };
}) {
  const [lineasModo, setLineasModo] = useState(inicial.lineasModo === "seleccionadas" ? "seleccionadas" : "todas");
  const [lineasIds, setLineasIds] = useState<string[]>(inicial.lineasIds);
  const [asesoresModo, setAsesoresModo] = useState(inicial.asesoresModo === "seleccionados" ? "seleccionados" : "todos");
  const [asesoresIds, setAsesoresIds] = useState<string[]>(inicial.asesoresIds);
  const [aviso, setAviso] = useState<{ error: boolean; texto: string } | null>(null);
  const [guardando, startTransition] = useTransition();

  const alternar = (lista: string[], set: (v: string[]) => void, id: string) =>
    set(lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);

  const resumenLineas =
    lineasModo === "todas"
      ? "todas las líneas"
      : lineasIds.length === 0
        ? "ninguna línea"
        : lineas.filter((l) => lineasIds.includes(l.id)).map((l) => l.nombre).join(", ");
  const nombresAsesores = [
    ...asesores.filter((a) => asesoresIds.includes(a.id)).map((a) => a.nombre),
    ...(asesoresIds.includes(SIN_ASIGNAR) ? ["chats sin asignar"] : []),
  ];
  const resumenAsesores =
    asesoresModo === "todos" ? "todos los chats" : nombresAsesores.length === 0 ? "ningún chat" : `los chats de ${nombresAsesores.join(", ")}`;

  function guardar() {
    setAviso(null);
    startTransition(async () => {
      const r = await guardarAlcanceDelVendedor({ lineasModo, lineasIds, asesoresModo, asesoresIds });
      setAviso("error" in r ? { error: true, texto: r.error ?? "No se pudo guardar." } : { error: false, texto: "Guardado." });
    });
  }

  return (
    <div className="rounded-[13px] border border-border bg-surface p-4">
      <p className="text-sm font-semibold text-foreground">Dónde responde</p>
      <p className="mt-0.5 text-xs text-muted">
        Encendido, {nombre} responde en {resumenLineas} y en {resumenAsesores}. Los demás chats los atiende el agente de IA de su línea, si lo tiene. Los números de prueba siempre reciben respuesta.
      </p>

      <p className="mt-4 text-xs font-semibold text-foreground">Líneas</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <Opcion activa={lineasModo === "todas"} onClick={() => setLineasModo("todas")}>Todas las líneas</Opcion>
        <Opcion activa={lineasModo === "seleccionadas"} onClick={() => setLineasModo("seleccionadas")}>Solo estas</Opcion>
      </div>
      {lineasModo === "seleccionadas" && (
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {lineas.length === 0 && <p className="text-xs text-muted">No hay líneas conectadas.</p>}
          {lineas.map((l) => (
            <Casilla key={l.id} marcada={lineasIds.includes(l.id)} onChange={() => alternar(lineasIds, setLineasIds, l.id)}>
              {l.nombre}
            </Casilla>
          ))}
        </div>
      )}

      <p className="mt-4 text-xs font-semibold text-foreground">Chats de qué asesores</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <Opcion activa={asesoresModo === "todos"} onClick={() => setAsesoresModo("todos")}>Todos</Opcion>
        <Opcion activa={asesoresModo === "seleccionados"} onClick={() => setAsesoresModo("seleccionados")}>Solo estos</Opcion>
      </div>
      {asesoresModo === "seleccionados" && (
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          <Casilla marcada={asesoresIds.includes(SIN_ASIGNAR)} onChange={() => alternar(asesoresIds, setAsesoresIds, SIN_ASIGNAR)}>
            Chats sin asignar
          </Casilla>
          {asesores.map((a) => (
            <Casilla key={a.id} marcada={asesoresIds.includes(a.id)} onChange={() => alternar(asesoresIds, setAsesoresIds, a.id)}>
              {a.nombre}
            </Casilla>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="rounded-[9px] bg-primary px-4 py-2 text-[13px] font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        {aviso && <span className={`text-xs ${aviso.error ? "text-red-400" : "text-success"}`}>{aviso.texto}</span>}
      </div>
    </div>
  );
}
