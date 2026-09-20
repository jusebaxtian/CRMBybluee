import type { ReactNode } from "react";

/**
 * Pantalla de aviso a pantalla completa (error, 404). Misma familia visual
 * que public/sin-conexion.html: fondo oscuro, icono con ondas y boton verde.
 */
export function PantallaAviso({
  icono,
  titulo,
  texto,
  children,
}: {
  icono: ReactNode;
  titulo: string;
  texto: string;
  children?: ReactNode;
}) {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 py-8 text-center font-dash-ui text-[#eef3ef]"
      style={{ background: "radial-gradient(360px 260px at 50% 30%, #1ba84a1f, transparent 70%), #0a0f0c" }}
    >
      <div className="flex items-center gap-2 text-[16px] font-extrabold tracking-tight">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="h-6 w-6 rounded-[7px]" />
        ByBluee
      </div>
      <div className="relative mx-auto mb-1 mt-2 grid h-24 w-24 place-items-center" aria-hidden>
        <span className="absolute inset-0 animate-[viva-onda_2.4s_ease-out_infinite] rounded-full border-2 border-[#1ba84a66]" />
        <span className="absolute inset-0 animate-[viva-onda_2.4s_ease-out_infinite_1.2s] rounded-full border-2 border-[#1ba84a66]" />
        <span className="relative z-10 text-[#7ee3a1]">{icono}</span>
      </div>
      <h1 className="text-[26px] font-bold tracking-tight">{titulo}</h1>
      <p className="mx-auto max-w-[30ch] text-[15px] leading-relaxed text-[#a7b3ab]">{texto}</p>
      {children}
    </main>
  );
}

export const BOTON_AVISO =
  "mt-2 inline-flex items-center justify-center gap-2 rounded-[11px] bg-[#1ba84a] px-6 py-3 text-sm font-extrabold text-white shadow-[0_8px_24px_#1ba84a44] active:translate-y-px";
export const ENLACE_AVISO = "text-[13px] text-[#93a39a] underline";
