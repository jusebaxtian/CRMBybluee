"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";
import { X } from "lucide-react";

/**
 * La línea entre dos bloques, con una ✕ para quitarla.
 *
 * React Flow deja borrarla seleccionándola y pulsando Suprimir, pero eso no
 * se ve en ninguna parte: quien arma su primer flujo se queda con una línea
 * mal puesta y sin forma evidente de deshacerla. La ✕ aparece siempre, en
 * pequeño, y se agranda al pasar el cursor.
 */
export function ConexionBorrable({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
}: EdgeProps) {
  const { setEdges } = useReactFlow();
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <button
          type="button"
          title="Quitar esta conexión"
          // `nodrag nopan` es lo que hace que esto se pueda pulsar: sin esas
          // clases React Flow toma el boton de raton como el inicio de un
          // arrastre del lienzo y el clic nunca llega al boton.
          className="nodrag nopan flex h-[22px] w-[22px] items-center justify-center rounded-full border border-border bg-surface text-muted shadow-sm transition-all hover:scale-110 hover:border-red-400 hover:bg-red-400/10 hover:text-red-400"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setEdges((edges) => edges.filter((edge) => edge.id !== id));
          }}
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
            zIndex: 10,
          }}
        >
          <X size={12} />
        </button>
      </EdgeLabelRenderer>
    </>
  );
}
