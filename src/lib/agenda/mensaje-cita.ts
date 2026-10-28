import { textoDeFecha } from "@/lib/agenda/tiempo";

/**
 * El mensaje de confirmacion de una cita cuando la ventana de 24 horas esta
 * abierta (texto libre). Es el mismo que se manda y el que se muestra de vista
 * previa, asi lo que ves es lo que sale.
 */
export function textoDeConfirmacion(d: {
  nombre?: string | null;
  titulo: string;
  inicioIso: string;
  meetUrl?: string | null;
  /** Bloque "Importante" al final (ver nota-de-cita.ts). */
  nota?: string | null;
}): string {
  const nombre = d.nombre?.trim();
  const lineas = [
    `${nombre ? `Hola ${nombre}, ` : "Hola, "}te confirmo nuestra cita: *${d.titulo}*.`,
    `📅 ${textoDeFecha(d.inicioIso)} (hora de Colombia)`,
  ];
  if (d.meetUrl) lineas.push(`💻 Reunión por Meet: ${d.meetUrl}`);
  if (d.nota?.trim()) lineas.push("", d.nota.trim());
  return lineas.join("\n");
}
