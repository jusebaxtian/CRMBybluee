"use client";

import { Component, type ReactNode } from "react";

/**
 * Limite de error por bloque del dashboard.
 *
 * Cada tarjeta carga sus datos por separado (Suspense). Si una falla --Meta
 * no responde, una consulta se cae-- se muestra el aviso dentro de esa
 * tarjeta, del mismo tamaño y radio, y el resto de la pantalla sigue. Sin
 * esto, un fallo en cualquier bloque tumbaba el dashboard entero.
 */
export class Bloque extends Component<
  { children: ReactNode; nombre: string; className?: string },
  { fallo: boolean }
> {
  state = { fallo: false };

  static getDerivedStateFromError() {
    return { fallo: true };
  }

  render() {
    if (this.state.fallo) {
      return (
        <div
          role="alert"
          className={`flex items-center justify-center rounded-[13px] border border-dash-red-28 bg-dash-red-7 p-[18px] text-center text-[12.5px] text-dash-text-2 ${this.props.className ?? ""}`}
        >
          No se pudo cargar {this.props.nombre}. Recarga la página.
        </div>
      );
    }
    return this.props.children;
  }
}
