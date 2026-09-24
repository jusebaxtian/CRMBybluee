/**
 * Insignia de partner: "Meta Business Partners" + "WhatsApp Solution Partner".
 * Va en la web publica como sello de que ByBluee trabaja con la API oficial.
 * Los logos van en vectorial para que se vean nitidos en cualquier pantalla.
 */

function LogoMeta({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 36 24" width={size * 1.5} height={size} aria-hidden fill="none">
      <path
        d="M4.6 15.3c0 1.3.3 2.3.7 2.9.5.8 1.3 1.1 2.1 1.1 1 0 2-.3 3.8-2.8 1.4-2 3.1-4.8 4.2-6.6l1.9-2.9c1.3-2 2.8-4.2 4.5-5.7C23.2.1 24.7-.5 26.3-.5c2.6 0 5.1 1.5 7 4.4 2.1 3.1 3.1 7.1 3.1 11.2 0 2.4-.5 4.2-1.3 5.6-.8 1.3-2.3 2.6-4.8 2.6v-3.7c2.2 0 2.7-2 2.7-4.3 0-3.3-.8-6.9-2.4-9.5-1.2-1.9-2.7-3-4.4-3-1.8 0-3.3 1.4-5 3.9-.9 1.3-1.8 2.9-2.8 4.7l-1.2 2c-2.3 4-2.9 4.9-4.1 6.5-2.1 2.8-3.9 3.8-6.2 3.8-2.6 0-4.3-1.1-5.3-2.8C.6 19.4 0 17.5 0 15.3l4.6 0Z"
        fill="#0081FB"
      />
      <path
        d="M3.6 4.2C5.4 1.5 8 -.5 11 -.5c1.7 0 3.4.5 5.2 2 2 1.6 4.1 4.3 6.7 8.7l.9 1.6c2.3 3.8 3.6 5.8 4.4 6.7.9 1.2 1.6 1.6 2.4 1.6 2.2 0 2.7-2 2.7-4.3l4.1-.1c0 2.4-.5 4.2-1.3 5.6-.8 1.3-2.3 2.6-4.8 2.6-1.6 0-3-.3-4.5-1.8-1.2-1.1-2.6-3.1-3.7-4.9l-3.2-5.4c-1.6-2.7-3.1-4.7-3.9-5.6-.9-1-2.1-2.2-4-2.2-1.5 0-2.8.9-3.9 2.4L3.6 4.2Z"
        fill="#0064E1"
      />
    </svg>
  );
}

function LogoWhatsApp({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path
        fill="#25D366"
        d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.6 0-3.2-.4-4.5-1.3l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1-.2.2-.6.8-.8 1-.1.2-.3.2-.5.1-1.3-.6-2.2-1.2-3-2.6-.2-.4.2-.4.6-1.1.1-.2 0-.3 0-.5 0-.1-.5-1.3-.7-1.8-.2-.4-.4-.4-.5-.4h-.5c-.2 0-.5.1-.7.3-.7.7-1 1.6-1 2.6 0 1.6 1.1 3 1.3 3.3.2.2 2.2 3.5 5.4 4.7 2 .8 2.7.8 3.7.7.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.2-.5-.3Z"
      />
    </svg>
  );
}

/**
 * `compacta` la deja en una sola linea para el pie de pagina; sin ella
 * ocupa una franja propia con borde, para que se note.
 */
export function InsigniaPartner({ compacta = false }: { compacta?: boolean }) {
  const contenido = (
    <>
      <span className="flex items-center gap-2">
        <LogoMeta size={compacta ? 16 : 22} />
        <span className={`font-dash-display font-bold tracking-[-.02em] ${compacta ? "text-[14px]" : "text-[clamp(16px,2.2vw,22px)]"}`}>
          Meta Business Partners
        </span>
      </span>
      <span aria-hidden className={`h-5 w-px bg-border ${compacta ? "mx-1" : "mx-2 hidden sm:block"}`} />
      <span className="flex items-center gap-2">
        <LogoWhatsApp size={compacta ? 15 : 20} />
        <span className={`font-dash-display tracking-[-.02em] ${compacta ? "text-[14px]" : "text-[clamp(16px,2.2vw,22px)]"}`}>
          <b className="font-bold">WhatsApp</b> <span className="font-medium text-muted">Solution Partner</span>
        </span>
      </span>
    </>
  );

  if (compacta) {
    return <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-foreground">{contenido}</div>;
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 rounded-[14px] border border-border bg-[#0b100d] px-6 py-4 text-foreground shadow-[0_10px_40px_rgba(0,0,0,.35)]">
        {contenido}
      </div>
      <p className="text-[12px] text-[#7c8a82]">Somos partner oficial de Meta: tu número se conecta con la API oficial de WhatsApp Business.</p>
    </div>
  );
}
