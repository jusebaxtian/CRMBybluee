import Link from "next/link";
import { Check, ShoppingCart, PlayCircle } from "lucide-react";

/**
 * Un servicio de pago en la tienda de Capacitaciones.
 *
 * Lleva su propio ancho en telefono (248px, para deslizar de lado) y se ajusta
 * a la rejilla desde pantallas medianas.
 *
 * La portada se muestra COMPLETA, nunca recortada: las portadas son carteles
 * con texto repartido por toda la imagen, y un recorte (o un icono encima) se
 * lleva el titulo. Por eso la imagen va `contain` sobre un fondo oscuro: una
 * portada 16:9 llena el recuadro exacto, y una que no lo sea se ve entera con
 * franjas en vez de cortada.
 *
 * Sin descripcion en la tarjeta: titulo, precio y boton, como una tienda, para que
 * la fila sea baja y las capacitaciones de abajo se vean sin desplazarse. La
 * descripcion completa esta en la ficha.
 *
 * El precio y el boton van debajo de la imagen, no encima, igual que en una
 * tienda. "Comprar" lleva a la ficha, directo a los metodos de pago.
 */
export function TarjetaServicio({
  id,
  titulo,
  portadaUrl,
  precio,
  gratis,
  comprado,
}: {
  id: string;
  titulo: string;
  portadaUrl: string | null;
  precio: string;
  gratis: boolean;
  comprado: boolean;
}) {
  const ficha = `/dashboard/tutoriales/curso/${id}`;

  return (
    <article className="group flex w-[232px] shrink-0 snap-start flex-col overflow-hidden sm:w-auto rounded-[13px] border border-border bg-surface transition-[transform,box-shadow,border-color] duration-200 hover:border-primary/60 hover:shadow-lg motion-safe:hover:-translate-y-0.5">
      <Link href={ficha} className="relative block aspect-video w-full bg-[#0e1411]" aria-label={titulo} tabIndex={-1}>
        {portadaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={portadaUrl} alt="" className="absolute inset-0 h-full w-full object-contain" loading="lazy" />
        ) : (
          <span className="absolute inset-0 bg-gradient-to-br from-[#16351f] to-[#0e1411]" />
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <Link href={ficha} className="text-[13.5px] font-semibold leading-snug text-foreground hover:text-primary">
          <span className="line-clamp-2">{titulo}</span>
        </Link>

        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          {comprado ? (
            <span className="flex items-center gap-1 text-[13px] font-bold text-success">
              <Check size={14} strokeWidth={3} /> Comprado
            </span>
          ) : (
            <span className="text-[17px] font-bold leading-none tracking-[-.2px] text-foreground">{gratis ? "Gratis" : precio}</span>
          )}
          {comprado ? (
            <Link
              href={ficha}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-[9px] border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-hover"
            >
              <PlayCircle size={13} /> Abrir
            </Link>
          ) : (
            <Link
              href={`${ficha}#pagar`}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-[9px] bg-primary px-3.5 py-1.5 text-xs font-bold text-white hover:bg-primary-hover"
            >
              <ShoppingCart size={13} /> {gratis ? "Obtener" : "Comprar"}
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
