"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { AlertTriangle, Check, Loader2, Save } from "lucide-react";
import { BLOQUES, BLOQUES_ARRASTRABLES, type DatosBloque, type TipoBloque } from "@/lib/flujos/bloques";
import { revisarFlujo, type Aviso } from "@/lib/flujos/validar";
import { BloqueNodo, type DatosNodo } from "@/components/flujos/bloque-nodo";
import { ConexionBorrable } from "@/components/flujos/conexion-borrable";
import { PanelBloque, type Catalogos } from "@/components/flujos/panel-bloque";
import { guardarLienzo } from "@/app/actions/flujos";

export type NodoInicial = { id: string; tipo: TipoBloque; datos: DatosBloque; x: number; y: number };
export type ConexionInicial = { origen: string; destino: string; salida: string | null };

const tiposDeNodo = { bloque: BloqueNodo };
// Todas las lineas llevan su ✕ para quitarlas.
const tiposDeConexion = { borrable: ConexionBorrable };

let contador = 0;
const nuevoId = () => "n" + Date.now() + contador++;

function Lienzo({
  flujoId,
  nodosIniciales,
  conexionesIniciales,
  etiquetas,
  catalogos,
}: {
  flujoId: string;
  nodosIniciales: NodoInicial[];
  conexionesIniciales: ConexionInicial[];
  etiquetas: { id: string; name: string }[];
  catalogos: Catalogos;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(
    nodosIniciales.map((n) => ({
      id: n.id,
      type: "bloque",
      position: { x: n.x, y: n.y },
      data: { tipo: n.tipo, datos: n.datos } satisfies DatosNodo,
    }))
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    conexionesIniciales.map((c, i) => ({
      id: "e" + i,
      source: c.origen,
      target: c.destino,
      sourceHandle: c.salida,
      type: "borrable",
      animated: true,
    }))
  );

  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { screenToFlowPosition } = useReactFlow();
  const lienzoRef = useRef<HTMLDivElement>(null);

  const avisos: Aviso[] = useMemo(
    () =>
      revisarFlujo(
        nodes.map((n) => {
          const d = n.data as unknown as DatosNodo;
          return { id: n.id, tipo: d.tipo, datos: d.datos };
        }),
        edges.map((e) => ({ origen_id: e.source, destino_id: e.target, salida: e.sourceHandle ?? null }))
      ),
    [nodes, edges]
  );
  const nodosConAviso = useMemo(
    () => new Set(avisos.map((a) => a.nodoId).filter(Boolean) as string[]),
    [avisos]
  );

  // Una salida solo puede llevar a un sitio: al conectar de nuevo desde el
  // mismo punto, la linea anterior se reemplaza en vez de acumularse.
  const onConnect = useCallback(
    (c: Connection) =>
      setEdges((prev) =>
        addEdge(
          { ...c, type: "borrable", animated: true },
          prev.filter((e) => !(e.source === c.source && (e.sourceHandle ?? null) === (c.sourceHandle ?? null)))
        )
      ),
    [setEdges]
  );

  const agregarBloque = useCallback(
    (tipo: TipoBloque, posicionPantalla?: { x: number; y: number }) => {
      const def = BLOQUES[tipo];
      if (def.maximo !== null) {
        const actuales = nodes.filter((n) => (n.data as unknown as DatosNodo).tipo === tipo).length;
        if (actuales >= def.maximo) return;
      }
      const marco = lienzoRef.current?.getBoundingClientRect();
      const pantalla = posicionPantalla ?? {
        x: (marco?.left ?? 0) + (marco?.width ?? 600) / 2,
        y: (marco?.top ?? 0) + (marco?.height ?? 400) / 2,
      };
      const position = screenToFlowPosition(pantalla);
      const datos: DatosBloque =
        tipo === "esperar" ? { minutos: 5 } : tipo === "botones" ? { botones: ["", ""] } : {};
      setNodes((prev) => [
        ...prev,
        { id: nuevoId(), type: "bloque", position, data: { tipo, datos } satisfies DatosNodo },
      ]);
    },
    [nodes, screenToFlowPosition, setNodes]
  );

  const datosDelSeleccionado = seleccionado
    ? (nodes.find((n) => n.id === seleccionado)?.data as unknown as DatosNodo | undefined)
    : undefined;

  async function guardar() {
    setGuardando(true);
    setError(null);
    setGuardado(false);
    const resultado = await guardarLienzo(
      flujoId,
      nodes.map((n) => {
        const d = n.data as unknown as DatosNodo;
        return { id: n.id, tipo: d.tipo, datos: d.datos, x: n.position.x, y: n.position.y };
      }),
      edges.map((e) => ({ origen: e.source, destino: e.target, salida: e.sourceHandle ?? null }))
    );
    setGuardando(false);
    if ("error" in resultado && resultado.error) {
      setError(resultado.error);
      return;
    }
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2500);
  }

  const errores = avisos.filter((a) => a.nivel === "error").length;

  return (
    <div className="flex h-[calc(100vh-230px)] min-h-[480px] overflow-hidden rounded-[13px] border border-border bg-surface">
      {/* La paleta se desplaza sola: con doce bloques ya no caben en pantalla y
          los de abajo quedaban cortados sin forma de llegar a ellos. El
          titulo se queda fijo arriba para no perder la referencia. */}
      <div className="flex w-[190px] shrink-0 flex-col border-r border-border">
        <p className="shrink-0 px-3 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted">
          Bloques
        </p>
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3">
        {BLOQUES_ARRASTRABLES.map((tipo) => {
          const def = BLOQUES[tipo];
          return (
            <button
              key={tipo}
              type="button"
              draggable
              onDragStart={(e) => e.dataTransfer.setData("tipo", tipo)}
              onClick={() => agregarBloque(tipo)}
              className="rounded-[9px] border border-border bg-background px-2.5 py-2 text-left hover:border-primary"
            >
              <span className="block text-[12.5px] font-medium text-foreground">{def.nombre}</span>
              <span className="mt-0.5 block text-[10.5px] leading-snug text-muted">{def.descripcion}</span>
            </button>
          );
        })}
          <p className="mt-1 text-[10.5px] leading-relaxed text-muted">
            Arrástralos al lienzo o haz clic. Une los puntos de la derecha con el siguiente bloque, y para
            quitar una línea haz clic en la ✕ que tiene en el medio.
          </p>
        </div>
      </div>

      <div className="relative min-w-0 flex-1" ref={lienzoRef}>
        <ReactFlow
          nodes={nodes.map((n) => ({
            ...n,
            data: { ...(n.data as unknown as DatosNodo), conAviso: nodosConAviso.has(n.id) },
          }))}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={tiposDeNodo}
          edgeTypes={tiposDeConexion}
          onNodeClick={(_, n) => setSeleccionado(n.id)}
          onPaneClick={() => setSeleccionado(null)}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
          }}
          onDrop={(e) => {
            e.preventDefault();
            const tipo = e.dataTransfer.getData("tipo") as TipoBloque;
            if (tipo) agregarBloque(tipo, { x: e.clientX, y: e.clientY });
          }}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={18} size={1} color="var(--border)" />
          <Controls showInteractive={false} />
        </ReactFlow>

        <div className="pointer-events-none absolute left-0 right-0 top-0 flex items-start justify-between gap-3 p-3">
          <div className="pointer-events-auto flex max-w-[60%] flex-col gap-1">
            {avisos.slice(0, 3).map((a, i) => (
              <span
                key={i}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${
                  a.nivel === "error"
                    ? "border-red-400/40 bg-red-400/10 text-red-400"
                    : "border-warning/40 bg-warning/10 text-warning"
                }`}
              >
                <AlertTriangle size={11} className="shrink-0" />
                <span className="truncate">{a.texto}</span>
              </span>
            ))}
            {avisos.length > 3 && <span className="text-[11px] text-muted">y {avisos.length - 3} aviso(s) más</span>}
          </div>

          <div className="pointer-events-auto flex items-center gap-2">
            {error && <span className="text-[11px] text-red-400">{error}</span>}
            {guardado && (
              <span className="flex items-center gap-1 text-[11px] text-success">
                <Check size={12} /> Guardado
              </span>
            )}
            <button
              type="button"
              onClick={guardar}
              disabled={guardando || errores > 0}
              title={errores > 0 ? "Corrige los errores antes de guardar" : undefined}
              className="flex items-center gap-1.5 rounded-[9px] bg-primary px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {guardando ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </div>

      {seleccionado && datosDelSeleccionado && (
        <PanelBloque
          tipo={datosDelSeleccionado.tipo}
          datos={datosDelSeleccionado.datos}
          etiquetas={etiquetas}
          catalogos={catalogos}
          onCambiar={(datos) =>
            setNodes((prev) =>
              prev.map((n) =>
                n.id === seleccionado ? { ...n, data: { ...(n.data as unknown as DatosNodo), datos } } : n
              )
            )
          }
          onBorrar={() => {
            setNodes((prev) => prev.filter((n) => n.id !== seleccionado));
            setEdges((prev) => prev.filter((e) => e.source !== seleccionado && e.target !== seleccionado));
            setSeleccionado(null);
          }}
          onCerrar={() => setSeleccionado(null)}
        />
      )}
    </div>
  );
}

export function LienzoFlujo(props: {
  flujoId: string;
  nodosIniciales: NodoInicial[];
  conexionesIniciales: ConexionInicial[];
  etiquetas: { id: string; name: string }[];
  catalogos: Catalogos;
}) {
  return (
    <ReactFlowProvider>
      <Lienzo {...props} />
    </ReactFlowProvider>
  );
}
