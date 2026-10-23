import { Download } from "lucide-react";

/**
 * "Soporte PDF" de un pago aprobado.
 *
 * Con los datos legales registrados descarga directo. Sin ellos no hay soporte
 * que valga --saldria sin la razon social ni el NIT de quien compra--, asi que
 * el boton lleva al formulario de datos legales, que esta en la misma pagina.
 */
export function DescargarSoporte({ paymentId, datosListos }: { paymentId: string; datosListos: boolean }) {
  const clase =
    "inline-flex items-center gap-1.5 rounded-[8px] border border-border px-2.5 py-1 text-xs font-medium text-primary hover:bg-surface-hover";

  if (datosListos) {
    return (
      <a href={`/api/soporte/${paymentId}`} className={clase}>
        <Download size={12} />
        Cuenta de cobro
      </a>
    );
  }

  return (
    <a href="#datos-legales" className={clase} title="Registra los datos legales de tu empresa para descargar la cuenta de cobro">
      Completar datos
    </a>
  );
}
