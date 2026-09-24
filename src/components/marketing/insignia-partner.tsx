/**
 * Insignia de partner: "Meta Business Partners" + "WhatsApp Solution Partner".
 * Va en la web publica como sello de que ByBluee trabaja con la API oficial.
 *
 * Los logos son los trazos oficiales de cada marca en vectorial, para que se
 * vean nitidos en cualquier pantalla y no se deformen.
 */

function LogoMeta({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <defs>
        <linearGradient id="meta-azul" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0064E1" />
          <stop offset="55%" stopColor="#0082FB" />
          <stop offset="100%" stopColor="#0064E1" />
        </linearGradient>
      </defs>
      <path
        fill="url(#meta-azul)"
        d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.017 1.57 1.517 3.95 1.517 6.319 0 1.336-.272 2.18-.732 2.792-.441.584-1.088.878-1.958.878-.548 0-1.026-.152-1.626-.86-.4-.47-.96-1.24-1.834-2.68l-.86-1.435-.912-1.52c-.152-.252-.302-.5-.45-.74.208-.32.416-.63.62-.926.418-.606.824-1.14 1.213-1.588.807-.928 1.598-1.24 2.03-1.24zm-10.28.087c.54 0 1.062.194 1.66.674.442.354.964.923 1.583 1.723a45.24 45.24 0 0 0-.55.83c-.394.6-.79 1.232-1.19 1.89l-.588.96c-1.093 1.79-1.8 2.786-2.36 3.355-.49.498-.905.667-1.36.667-.632 0-1.196-.24-1.583-.87-.32-.52-.508-1.246-.508-2.108 0-1.723.406-3.64 1.203-5.078.647-1.168 1.5-1.943 2.693-1.943z"
      />
    </svg>
  );
}

function LogoWhatsApp({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#25D366" />
      <path
        fill="#fff"
        transform="translate(3.2 3.2) scale(0.733)"
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347M12.05 21.785h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884"
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
      <span className="flex items-center gap-2.5">
        <LogoMeta size={compacta ? 18 : 26} />
        <span className={`font-dash-display font-bold tracking-[-.02em] ${compacta ? "text-[14px]" : "text-[clamp(16px,2.2vw,22px)]"}`}>
          Meta Business Partners
        </span>
      </span>
      {compacta && <span aria-hidden className="mx-1 h-5 w-px bg-border" />}
      <span className="flex items-center gap-2.5">
        <LogoWhatsApp size={compacta ? 17 : 24} />
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
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 rounded-[14px] border border-border bg-[#0b100d] px-6 py-4 text-foreground shadow-[0_10px_40px_rgba(0,0,0,.35)]">
        {contenido}
      </div>
      <p className="text-[12px] text-[#7c8a82]">Somos partner oficial de Meta: tu número se conecta con la API oficial de WhatsApp Business.</p>
    </div>
  );
}
