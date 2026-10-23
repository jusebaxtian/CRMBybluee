import { Reveal } from "@/components/marketing/reveal";

/**
 * Seccion "API y Webhooks" de la pagina principal (diseño "Centro de conexiones"):
 * ByBluee en el centro, lo que entra por API a un lado y lo que sale por webhook
 * al otro, y tres tarjetas debajo. Solo promete lo que existe hoy.
 */

const ENTRAN: [string, string, string][] = [
  ["🧾", "Facturación", "Avisa la factura nueva"],
  ["📦", "ERP o inventario", "Mantén tus contactos al día"],
  ["🛒", "Tienda en línea", "Confirma pedidos y carritos"],
  ["⌨️", "Tu propio software", "Cualquier sistema con internet"],
];

const SALEN: [string, string, string][] = [
  ["⚡", "Zapier · Make · n8n", "Sin escribir código"],
  ["🖥️", "Tu servidor", "Recibe cada mensaje al instante"],
  ["📊", "Hojas y bases de datos", "Guarda cada conversación"],
  ["🔔", "Alertas y tableros", "Entérate cuando algo pasa"],
];

const TARJETAS: [string, string, string][] = [
  ["↗", "Envía", "Mensajes de texto y plantillas aprobadas por Meta, desde cualquier sistema. Aparecen en tu bandeja como cualquier otro."],
  ["↙", "Recibe", "Webhooks firmados cuando llega un mensaje, se entrega o se lee, o cuando cambia un contacto. Con reintentos si tu servidor falla."],
  ["🔑", "Controla", "Cada aplicación con su propia llave y solo los permisos que necesita. Revócala cuando quieras."],
];

function Nodo({ icono, titulo, detalle }: { icono: string; titulo: string; detalle: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[13px] border border-border bg-surface px-[15px] py-[13px] text-sm font-bold transition duration-300 hover:-translate-y-0.5 hover:border-primary/50">
      <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px] bg-primary/15 text-base">{icono}</span>
      <div>
        {titulo}
        <small className="block text-xs font-medium text-muted">{detalle}</small>
      </div>
    </div>
  );
}

export function ApiConexiones({
  waHref,
  btn,
  btnGhost,
  eyebrow,
  h2,
}: {
  waHref: string;
  btn: string;
  btnGhost: string;
  eyebrow: string;
  h2: string;
}) {
  return (
    <section id="api" className="relative overflow-hidden border-b border-border py-20">
      <div className="pointer-events-none absolute inset-x-[-10%] top-[-20%] h-[70%] bg-[radial-gradient(700px_380px_at_78%_25%,#1ba84a1f,transparent_65%),radial-gradient(500px_300px_at_10%_85%,#1ba84a10,transparent_60%)]" />
      <div className="relative mx-auto max-w-[1120px] px-5">
        <Reveal>
          <div className="mx-auto mb-11 max-w-[680px] text-center">
            <p className={eyebrow}>API y Webhooks</p>
            <h2 className={h2}>Tu WhatsApp, conectado a todo lo que ya usas</h2>
            <p className="mx-auto mt-3.5 max-w-[56ch] text-[16.5px] leading-[1.55] text-muted">
              Lo que pasa en tus otros sistemas puede escribirle a tus clientes, y lo que tus clientes escriben llega a tus sistemas. En ambos sentidos, en tiempo real.
            </p>
          </div>
        </Reveal>

        <Reveal delay={80}>
          <div className="grid items-center gap-5 md:grid-cols-[1fr_auto_1fr]">
            <div className="grid gap-3">
              <h6 className="text-[11.5px] font-extrabold uppercase tracking-[.12em] text-[#7c8a82]">Entra por API →</h6>
              {ENTRAN.map(([i, t, d]) => (
                <Nodo key={t} icono={i} titulo={t} detalle={d} />
              ))}
            </div>

            <div className="mx-auto grid h-[200px] w-[200px] place-items-center rounded-full border border-primary/40 bg-[radial-gradient(circle_at_50%_40%,#12301c,#0c1410)] text-center shadow-[0_0_0_14px_#1ba84a10,0_0_0_30px_#1ba84a08,0_20px_60px_#1ba84a30]">
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="ByBluee" className="mx-auto mb-2 h-[54px] w-[54px] rounded-[14px]" />
                <b className="font-dash-display text-[17px] font-bold">ByBluee CRM</b>
                <span className="mt-0.5 block text-[11.5px] font-bold text-[#7ee3a1]">API oficial de WhatsApp</span>
              </div>
            </div>

            <div className="grid gap-3">
              <h6 className="text-[11.5px] font-extrabold uppercase tracking-[.12em] text-[#7c8a82]">← Sale por Webhook</h6>
              {SALEN.map(([i, t, d]) => (
                <Nodo key={t} icono={i} titulo={t} detalle={d} />
              ))}
            </div>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-3.5 md:grid-cols-3">
          {TARJETAS.map(([ic, t, d], i) => (
            <Reveal key={t} delay={i * 80}>
              <div className="h-full rounded-[16px] border border-border bg-surface p-5 transition duration-300 hover:-translate-y-1.5 hover:border-primary/50">
                <div className="grid h-[38px] w-[38px] place-items-center rounded-[10px] bg-primary/15 text-lg font-black text-[#7ee3a1]">{ic}</div>
                <h3 className="mb-1.5 mt-3 font-dash-display text-lg font-bold tracking-[-.02em]">{t}</h3>
                <p className="text-[13.5px] leading-[1.55] text-muted">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <div className="mt-9 flex flex-wrap justify-center gap-2.5">
            <a href={waHref} target="_blank" rel="noopener noreferrer" className={btn}>Quiero la API →</a>
            <a href={waHref} target="_blank" rel="noopener noreferrer" className={btnGhost}>Hablar con ventas</a>
          </div>
          <p className="mt-3.5 text-center text-[12.5px] text-[#7c8a82]">Módulo adicional · Incluye documentación con ejemplos, OpenAPI y colección de Postman</p>
        </Reveal>
      </div>
    </section>
  );
}
