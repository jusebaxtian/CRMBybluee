"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { BOTON_AVISO, ENLACE_AVISO, PantallaAviso } from "@/components/ui/pantalla-aviso";

/** Error de render en cualquier ruta: misma familia visual que "Sin conexion". */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("error de pagina:", error);
  }, [error]);

  return (
    <PantallaAviso
      icono={<RefreshCw size={44} strokeWidth={2} />}
      titulo="Algo no cargó"
      texto="Tuvimos un problema al abrir esta pantalla. Tus datos están a salvo; inténtalo de nuevo."
    >
      <button type="button" onClick={reset} className={BOTON_AVISO}>
        Reintentar
      </button>
      <Link href="/dashboard/inbox" className={ENLACE_AVISO}>
        Volver a la bandeja
      </Link>
    </PantallaAviso>
  );
}
