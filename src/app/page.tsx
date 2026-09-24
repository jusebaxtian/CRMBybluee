import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Reveal } from "@/components/marketing/reveal";
import { SocialLinks } from "@/components/marketing/social-links";
import { InsigniaPartner } from "@/components/marketing/insignia-partner";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";
import { AgenteEscribiendo, BandejaViva, Cinta, Contador, Flujo, Testimonios } from "@/components/marketing/viva";
import { getActivePlansWithFeatures, planCycleLabel, formatCents } from "@/lib/billing/plans";

/**
 * Pagina principal "Bandeja viva": el producto se ve funcionando desde el
 * primer segundo y la estructura lleva al cierre: problema -> que hace ->
 * como funciona -> IA -> resultados -> planes -> preguntas -> CTA.
 */

const CLIENTES = ["tusrepuestos.com.co", "Crédito Brilla", "Lavaseco Unitex", "GRUPO EXPRO", "Tokio Mayoristas", "SERVIRPLUS", "Asesorías Académicas", "GC Solutions", "Wom Colombia", "YANLA SHOPS"];

const PAISES: [string, string][] = [
  ["🇨🇴", "Colombia"], ["🇲🇽", "México"], ["🇦🇷", "Argentina"], ["🇨🇱", "Chile"], ["🇵🇪", "Perú"], ["🇪🇨", "Ecuador"], ["🇻🇪", "Venezuela"],
  ["🇧🇴", "Bolivia"], ["🇵🇾", "Paraguay"], ["🇺🇾", "Uruguay"], ["🇬🇹", "Guatemala"], ["🇭🇳", "Honduras"], ["🇸🇻", "El Salvador"],
  ["🇳🇮", "Nicaragua"], ["🇨🇷", "Costa Rica"], ["🇵🇦", "Panamá"], ["🇩🇴", "Rep. Dominicana"], ["🇨🇺", "Cuba"], ["🇵🇷", "Puerto Rico"],
  ["🇪🇸", "España"], ["🇺🇸", "Hispanos en EE. UU."],
];

const FUNCIONES: [string, string, string][] = [
  ["▤", "Tu equipo en el mismo número", "Añade personas a tu equipo: cada una entra con su usuario, responde desde el mismo número y recibe los chats que le asignes. Tú lo ves todo."],
  ["⚡", "Automatizaciones", "Bienvenida, palabras clave, botones y asignación automática desde el primer mensaje."],
  ["↻", "Seguimientos", "Si el cliente deja de responder, el CRM insiste con el mensaje y el tiempo que definas."],
  ["◎", "Campañas masivas", "Plantillas aprobadas por Meta, segmentadas por etiqueta, con reporte de entrega y lectura."],
  ["✦", "Agente de IA", "Responde con tu tono cuando no hay nadie, y entrega la conversación a una persona cuando toca."],
  ["📱", "App móvil", "Responde desde el celular con la misma bandeja, notificaciones al instante y notas de voz. Tu equipo atiende desde donde esté."],
  ["⏰", "Agenda y reportes", "Recordatorios por cliente en un calendario y reportes de tiempos de respuesta y ventas."],
  ["∞", "Activo 24/7", "Nunca se apaga: responde, asigna e insiste de noche, fines de semana y festivos, aunque nadie esté conectado."],
];

const FAQ: [string, string][] = [
  ["¿ByBluee usa la API oficial de WhatsApp?", "Sí. Conectas tu número con el registro oficial de Meta desde el mismo CRM. No usamos celulares conectados ni métodos que bloqueen tu línea."],
  ["¿Puedo tener varias personas respondiendo el mismo número?", "Sí. Añades a tu equipo, cada persona entra con su usuario (web o app móvil), recibe los chats que le asignas y tú ves todo. Ilimitado en PRO."],
  ["¿Tienen aplicación para el celular?", "Sí. La misma bandeja en tu celular, con notificaciones al instante y notas de voz, para responder desde donde estés."],
  ["¿Puedo pausar la IA o las automatizaciones?", "En cualquier chat, con un botón. También puedes limitar cada automatización a una línea o a una etiqueta."],
  ["¿Las plantillas las aprueba Meta?", "Sí, se envían a aprobación desde el CRM y normalmente responden en minutos. Con plantilla aprobada puedes escribirle a quien quieras, aun fuera de las 24 horas."],
  ["¿Qué pasa con mi historial si cambio de celular o de equipo?", "Nada: el historial vive en el CRM, no en un teléfono."],
];

const BTN = "inline-flex items-center gap-2 rounded-[11px] bg-primary px-[18px] py-3 text-sm font-extrabold text-white shadow-[0_8px_24px_#1ba84a44] transition hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-[0_14px_34px_#1ba84a66]";
const BTN_GHOST = "inline-flex items-center gap-2 rounded-[11px] border border-[#2a3630] px-[18px] py-3 text-sm font-extrabold text-foreground transition hover:-translate-y-0.5 hover:border-primary/60";
const EYEBROW = "text-xs font-extrabold uppercase tracking-[.14em] text-primary";
const H2 = "mt-2.5 font-dash-display text-[clamp(28px,3.6vw,42px)] font-bold leading-[1.05] tracking-[-.03em] text-foreground text-balance";

export default async function Home() {
  const supabase = await createClient();
  const plans = await getActivePlansWithFeatures(supabase);

  const { data: supportSetting } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "support_whatsapp_number")
    .maybeSingle();
  const salesWhatsappNumber = supportSetting?.value || "573000000000";
  const waHref = `https://wa.me/${salesWhatsappNumber}?text=${encodeURIComponent("Hola, quiero información sobre CRM ByBluee.")}`;

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="ByBluee" className="h-8 w-8 rounded-lg" />
            <span className="font-dash-display text-lg font-bold">ByBluee</span>
          </Link>
          <nav className="hidden items-center gap-6 text-[13.5px] text-muted md:flex">
            <a href="#que" className="hover:text-foreground">Qué hace</a>
            <a href="#flujo" className="hover:text-foreground">Cómo funciona</a>
            <a href="#ia" className="hover:text-foreground">Agente IA</a>
            <a href="#planes" className="hover:text-foreground">Planes</a>
            <a href="#faq" className="hover:text-foreground">Preguntas</a>
          </nav>
          <div className="flex gap-2">
            <Link href="/login" className={`${BTN_GHOST} hidden px-4 py-2.5 sm:inline-flex`}>Iniciar sesión</Link>
            <Link href="/signup" className={`${BTN} px-4 py-2.5`}>Crear cuenta</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden pb-12 pt-16">
        <div className="viva-aura pointer-events-none absolute inset-x-[-10%] top-[-20%] h-[70%] bg-[radial-gradient(700px_380px_at_75%_20%,#1ba84a2e,transparent_65%),radial-gradient(500px_300px_at_15%_80%,#1ba84a14,transparent_60%)]" />
        <div className="relative mx-auto grid max-w-[1120px] items-center gap-10 px-5 md:grid-cols-[1.05fr_1fr]">
          <div>
            <Reveal><p className={EYEBROW}>API oficial de WhatsApp Business · Meta</p></Reveal>
            <Reveal delay={80}>
              <h1 className="mb-4 mt-3.5 font-dash-display text-[clamp(38px,5.4vw,66px)] font-bold leading-[1] tracking-[-.03em] text-balance">
                Tu WhatsApp responde, <span className="viva-sub relative inline-block text-primary">insiste</span> y vende. Tú solo cierras.
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="max-w-[52ch] text-[17px] leading-[1.55] text-muted">
                Un número oficial con todo tu equipo dentro, activo 24/7. Respuestas automáticas en segundos, seguimientos al que se enfría y campañas que no bloquean tu línea. Desde el computador o desde la app móvil.
              </p>
            </Reveal>
            <Reveal delay={220}>
              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <Link href="/signup" className={BTN}>Crear mi cuenta <ArrowRight size={16} /></Link>
                <a href="#flujo" className={BTN_GHOST}>Ver cómo funciona</a>
              </div>
              <div className="mt-3 flex flex-wrap gap-3.5 text-[12.5px] text-[#7c8a82]">
                {["Conectas tu número en 5 minutos", "App móvil incluida", "Activo 24/7", "Soporte por WhatsApp"].map((t) => (
                  <span key={t}><b className="font-extrabold text-primary">✓</b> {t}</span>
                ))}
              </div>
              <div className="mt-5 w-fit">
                <InsigniaPartner />
              </div>
              <div className="mt-4 flex items-center gap-3">
                <SocialLinks />
                <a href={waHref} target="_blank" rel="noopener noreferrer" aria-label="Escríbenos por WhatsApp" className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border text-muted transition hover:-translate-y-0.5 hover:border-primary hover:text-primary">
                  <WhatsAppIcon size={17} />
                </a>
              </div>
            </Reveal>
            <Reveal delay={280}>
              <div className="mt-7 flex flex-wrap gap-7">
                <div><Contador hasta={5000} prefijo="+" className="block font-dash-display text-[40px] leading-none tracking-[-.03em]" /><span className="text-xs text-[#7c8a82]">negocios activos</span></div>
                <div><Contador hasta={100000} prefijo="+" className="block font-dash-display text-[40px] leading-none tracking-[-.03em]" /><span className="text-xs text-[#7c8a82]">mensajes al día</span></div>
                <div><Contador hasta={2} sufijo=" seg" className="block font-dash-display text-[40px] leading-none tracking-[-.03em]" /><span className="text-xs text-[#7c8a82]">y tu cliente ya está atendido</span></div>
              </div>
            </Reveal>
          </div>
          <BandejaViva />
        </div>
      </section>

      {/* Clientes */}
      <div className="border-y border-border bg-surface/40 py-4">
        <Cinta velocidad={28} items={CLIENTES.map((c) => <span key={c} className="text-[13px] font-bold text-[#7c8a82]"><span className="mr-2.5 text-[9px] text-primary align-[2px]">◆</span>{c}</span>)} />
      </div>

      {/* Países */}
      <section className="border-b border-border bg-[linear-gradient(90deg,#0e1411,#12261a_50%,#0e1411)] py-7">
        <div className="mx-auto flex max-w-[1120px] flex-col items-center gap-3.5 px-5 text-center">
          <Reveal>
            <p className={EYEBROW}>Toda Latinoamérica</p>
            <h3 className="mt-2 font-dash-display text-[clamp(20px,2.6vw,28px)] font-bold tracking-[-.02em] text-balance">Conecta la API de WhatsApp en cualquier país de habla hispana</h3>
            <p className="mx-auto mt-2 max-w-[60ch] text-sm text-muted">Un solo CRM, en español, para números de todos estos países. Conectas tu línea con el registro oficial de Meta desde el mismo panel.</p>
          </Reveal>
          <Cinta velocidad={40} className="w-full" items={PAISES.map(([b, n]) => <span key={n} className="text-[13px] font-semibold"><em className="mr-2 text-[26px] not-italic leading-none align-middle">{b}</em>{n} <b className="text-[11px] font-black text-primary">✓</b></span>)} />
        </div>
      </section>

      {/* Problema */}
      <section id="problema" className="mx-auto max-w-[1120px] px-5 py-20">
        <Reveal>
          <div className="mx-auto mb-10 max-w-[640px] text-center">
            <p className={EYEBROW}>El problema real</p>
            <h2 className={H2}>Un WhatsApp sin sistema pierde ventas</h2>
            <p className="mt-3 leading-[1.55] text-muted">Con el WhatsApp normal los chats se pierden en el scroll, nadie sabe quién atendió qué y el cliente que no respondió se enfría para siempre. Con ByBluee llevas tu negocio en el celular, pero con orden, equipo y automatización.</p>
          </div>
        </Reveal>
        <Reveal>
          <div className="relative grid gap-4 md:grid-cols-2">
            <div className="rounded-[16px] border border-border bg-surface/60 p-6">
              <h3 className="mb-3 font-dash-display text-xl font-semibold">WhatsApp normal</h3>
              <ul className="grid gap-2.5 text-sm text-muted">
                {["Todo el historial atrapado en un solo teléfono", "Clientes sin respuesta por horas", "Envíos masivos que terminan en bloqueo", "Nadie hace seguimiento al que no compró"].map((t) => (
                  <li key={t}><b className="font-extrabold text-red-400">✕</b> {t}</li>
                ))}
              </ul>
            </div>
            <div className="viva-arrow absolute left-1/2 top-1/2 z-10 hidden h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-primary font-black text-white md:grid">→</div>
            <div className="rounded-[16px] border border-primary/40 bg-[linear-gradient(180deg,#12261a,#0e1411)] p-6 shadow-[0_20px_60px_#1ba84a1a]">
              <h3 className="mb-3 font-dash-display text-xl font-semibold">Con ByBluee</h3>
              <ul className="grid gap-2.5 text-sm text-[#dbe9df]">
                {["Tu negocio en el celular, con la app, y todo el equipo en el mismo número", "Responde en 2 segundos, 24/7, todos los días", "Campañas con plantillas aprobadas por Meta", "Seguimientos automáticos hasta que responde"].map((t) => (
                  <li key={t}><b className="font-extrabold text-primary">✓</b> {t}</li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Qué hace */}
      <section id="que" className="border-y border-border bg-surface/40 py-20">
        <div className="mx-auto max-w-[1120px] px-5">
          <Reveal>
            <div className="mx-auto mb-10 max-w-[640px] text-center">
              <p className={EYEBROW}>Qué hace por ti</p>
              <h2 className={H2}>Todo lo que necesitas para vender por WhatsApp</h2>
            </div>
          </Reveal>
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {FUNCIONES.map(([ic, t, d], i) => (
              <Reveal key={t} delay={i * 60}>
                <div className="group relative h-full overflow-hidden rounded-[16px] border border-border bg-background p-5 transition duration-300 hover:-translate-y-1.5 hover:border-primary/50 hover:shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
                  <div className="pointer-events-none absolute -bottom-[60%] -right-[40%] h-[220px] w-[220px] rounded-full bg-[radial-gradient(#1ba84a33,transparent_70%)] opacity-0 transition group-hover:opacity-100" />
                  <div className="grid h-[38px] w-[38px] place-items-center rounded-[10px] bg-primary/15 text-lg font-black text-primary">{ic}</div>
                  <h3 className="mb-1.5 mt-3 font-dash-display text-lg font-semibold">{t}</h3>
                  <p className="text-[13.5px] leading-[1.55] text-muted">{d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Flujo */}
      <section id="flujo" className="mx-auto max-w-[1120px] px-5 py-20">
        <Reveal>
          <div className="mx-auto mb-10 max-w-[640px] text-center">
            <p className={EYEBROW}>Cómo funciona</p>
            <h2 className={H2}>De “hola” a venta, sin que se te escape nadie</h2>
          </div>
        </Reveal>
        <Flujo />
      </section>

      {/* IA */}
      <section id="ia" className="border-y border-border bg-surface/40 py-20">
        <div className="mx-auto grid max-w-[1120px] items-center gap-10 px-5 md:grid-cols-2">
          <Reveal>
            <p className={EYEBROW}>Agente de IA</p>
            <h2 className={H2}>Mientras tú duermes, tu agente responde.</h2>
            <p className="mt-3 leading-[1.6] text-muted">Le das instrucciones en español, tu catálogo y tu tono. Atiende, califica y, si el cliente pide hablar con alguien, te avisa y se hace a un lado.</p>
            <ul className="mt-4 grid gap-2 text-sm">
              {["Trabaja 24/7 y se pausa en cualquier chat con un botón", "Nunca inventa precios: usa lo que tú le diste", "Seguimientos con IA cuando el cliente no responde"].map((t) => (
                <li key={t}><b className="font-extrabold text-primary">→</b> {t}</li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={120}><AgenteEscribiendo /></Reveal>
        </div>
      </section>

      {/* Resultados */}
      <section id="prueba" className="mx-auto max-w-[1120px] px-5 py-20">
        <Reveal>
          <div className="mx-auto mb-10 max-w-[640px] text-center">
            <p className={EYEBROW}>Resultados</p>
            <h2 className={H2}>Negocios reales, en toda Latinoamérica</h2>
          </div>
        </Reveal>
        <div className="grid gap-6 md:grid-cols-[1.1fr_.9fr]">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              [5000, "+", "", "negocios activos"],
              [100000, "+", "", "mensajes al día"],
              [2, "", " seg", "para atender a tu cliente"],
              [24, "", "/7", "activo, todos los días"],
            ].map(([n, pre, suf, label], i) => (
              <Reveal key={String(label)} delay={i * 80}>
                <div className="rounded-[16px] border border-border bg-surface/60 p-5">
                  <Contador hasta={n as number} prefijo={pre as string} sufijo={suf as string} className="block font-dash-display text-[52px] leading-none tracking-[-.03em] text-foreground" />
                  <span className="text-[12.5px] text-[#7c8a82]">{label}</span>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={200}><Testimonios /></Reveal>
        </div>
      </section>

      {/* Planes */}
      <section id="planes" className="border-y border-border bg-surface/40 py-20">
        <div className="mx-auto max-w-[1120px] px-5">
          <Reveal>
            <div className="mx-auto mb-10 max-w-[640px] text-center">
              <p className={EYEBROW}>Planes</p>
              <h2 className={H2}>Un plan para cada etapa de tu negocio</h2>
              <p className="mt-3 text-muted">Precios en pesos colombianos. Cambias de plan cuando quieras.</p>
            </div>
          </Reveal>
          <div className="grid gap-3.5 md:grid-cols-3">
            {plans.map((plan, i) => {
              const featured = Boolean(plan.badge_label);
              return (
                <Reveal key={plan.id} delay={i * 100}>
                  <div className={`relative flex h-full flex-col rounded-[16px] border p-6 transition hover:-translate-y-1 ${featured ? "border-primary bg-[linear-gradient(180deg,#12261a,#0e1411)] shadow-[0_24px_60px_#1ba84a22]" : "border-border bg-background"}`}>
                    {plan.badge_label && (
                      <span className="absolute -top-[11px] left-[18px] rounded-full bg-primary px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.08em] text-white">{plan.badge_label}</span>
                    )}
                    <h5 className="text-xs font-semibold uppercase tracking-[.1em] text-muted">{plan.name}</h5>
                    <div className="mt-2 flex items-baseline gap-1.5">
                      <span className="font-dash-display text-4xl font-bold tracking-[-.03em]">${formatCents(plan.price_cents)}</span>
                      <span className="text-[13px] text-[#7c8a82]">{plan.currency} / {planCycleLabel(plan.billing_cycle)}</span>
                    </div>
                    <div className="min-h-4 text-xs font-bold text-[#7ee3a1]">
                      {plan.compare_price_cents !== null && <span className="mr-2 font-normal text-muted line-through">${formatCents(plan.compare_price_cents)}</span>}
                      {plan.savings_cents !== null && <>Ahorras ${formatCents(plan.savings_cents)}</>}
                    </div>
                    <ul className="my-4 grid flex-1 gap-2 text-[13.5px] text-[#dbe9df]">
                      {plan.features.map((f, fi) => (
                        <li key={`${plan.id}-${fi}`} className="flex items-start gap-2"><Check size={14} className="mt-0.5 shrink-0 text-primary" />{f}</li>
                      ))}
                    </ul>
                    <Link href="/signup" className={featured ? BTN : BTN_GHOST}>{featured ? `Empezar con ${plan.name}` : "Empezar"}</Link>
                  </div>
                </Reveal>
              );
            })}
          </div>
          <p className="mt-6 flex flex-wrap items-center justify-center gap-2.5 text-[12.5px] text-[#7c8a82]">
            <span>Paga con cualquier tarjeta</span>
            <span className="inline-flex flex-wrap justify-center gap-1.5">
              {["VISA", "MASTERCARD", "AMEX", "DINERS"].map((t) => (
                <b key={t} className="rounded-[5px] border border-border bg-background px-2 text-[10px] font-extrabold leading-[22px] tracking-[.06em] text-muted">{t}</b>
              ))}
            </span>
            <span>· también PSE, Nequi y transferencia</span>
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-[1120px] px-5 py-20">
        <Reveal>
          <div className="mx-auto mb-10 max-w-[640px] text-center">
            <p className={EYEBROW}>Preguntas</p>
            <h2 className={H2}>Lo que más nos preguntan</h2>
          </div>
        </Reveal>
        <Reveal>
          <div className="mx-auto grid max-w-[760px] gap-2.5">
            {FAQ.map(([q, a], i) => (
              <details key={q} open={i === 0} className="group rounded-[12px] border border-border bg-surface/60 px-[18px]">
                <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-[15px] font-bold">
                  {q}
                  <span className="text-xl text-primary transition group-open:rotate-45">+</span>
                </summary>
                <p className="mb-4 text-sm leading-[1.55] text-muted">{a}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Cierre */}
      <section className="relative overflow-hidden py-[90px] text-center">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_300px_at_50%_100%,#1ba84a33,transparent_70%)]" />
        <Reveal>
          <div className="relative mx-auto max-w-[760px] px-5">
            <p className={EYEBROW}>Empieza hoy</p>
            <h2 className="mt-2.5 font-dash-display text-[clamp(30px,4.6vw,54px)] font-bold leading-[1.02] tracking-[-.03em] text-balance">Lleva tu negocio en el celular, pero con sistema.</h2>
            <p className="mb-5 mt-3 text-muted">Crea tu cuenta, conecta tu número y responde en 2 segundos, 24/7, desde el computador o el celular.</p>
            <Link href="/signup" className={BTN}>Crear mi cuenta <ArrowRight size={16} /></Link>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-border py-6 text-[12.5px] text-[#7c8a82]">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-4 px-5">
          <div className="flex flex-col gap-2">
            <span className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="ByBluee" className="h-6 w-6 rounded-md" />
              <b className="font-dash-display text-foreground">ByBluee</b>
            </span>
            <span>© {new Date().getFullYear()} ByBluee · Colombia · Para toda Latinoamérica</span>
          </div>
          <div className="flex flex-col gap-2">
            <span className="flex flex-wrap gap-x-3">
              <Link href="/privacidad" className="hover:text-foreground">Privacidad</Link>
              <Link href="/terminos" className="hover:text-foreground">Términos</Link>
              <Link href="/eliminar-datos" className="hover:text-foreground">Eliminar datos</Link>
              <a href={waHref} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">Soporte por WhatsApp</a>
            </span>
            <span>Recibimos todas las tarjetas · PSE · Nequi · Transferencia</span>
          </div>
          <div className="my-2 w-full border-t border-border pt-4">
            <InsigniaPartner compacta />
          </div>
          <SocialLinks />
        </div>
      </footer>
    </div>
  );
}
