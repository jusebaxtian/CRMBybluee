import Link from "next/link";
import { Compass } from "lucide-react";
import { BOTON_AVISO, ENLACE_AVISO, PantallaAviso } from "@/components/ui/pantalla-aviso";

export default function NotFound() {
  return (
    <PantallaAviso
      icono={<Compass size={44} strokeWidth={2} />}
      titulo="Esta página no existe"
      texto="El enlace puede estar mal escrito o la página ya no está. Vuelve a la bandeja y sigue desde ahí."
    >
      <Link href="/dashboard/inbox" className={BOTON_AVISO}>
        Ir a la bandeja
      </Link>
      <Link href="/" className={ENLACE_AVISO}>
        Ir al inicio
      </Link>
    </PantallaAviso>
  );
}
