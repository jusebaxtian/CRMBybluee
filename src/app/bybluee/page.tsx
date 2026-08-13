import Link from "next/link";
import {
  ArrowRight,
  ShieldCheck,
  Zap as ZapIcon,
  LifeBuoy,
  RefreshCw,
  Check,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Reveal } from "@/components/reveal";
import { HeroInboxMockup } from "@/components/hero-inbox-mockup";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { SocialLinks } from "@/components/social-links";
import { features, includedItems, painPoints } from "@/lib/landing-content";

const trustBadges = [
  { icon: ShieldCheck, title: "100% seguro", text: "Tus datos siempre protegidos" },
  { icon: ZapIcon, title: "Activación rápida", text: "Empieza a vender hoy mismo" },
  { icon: LifeBuoy, title: "Soporte directo", text: "Te acompañamos siempre" },
  { icon: RefreshCw, title: "Mejoras constantes", text: "Siempre lo último del CRM" },
];

const pricingPlans = [
  {
    name: "CRM Bybluee Anual (1 Año)",
    priceLabel: "$150.000",
    featured: false,
    message: "Hola, quiero el plan Anual (1 año) de CRM ByBluee por $150.000 COP.",
  },
  {
    name: "CRM Bybluee Vitalicio",
    priceLabel: "$300.000",
    featured: true,
    message: "Hola, quiero el plan Vitalicio de CRM ByBluee por $300.000 COP.",
  },
  {
    name: "Plan Emprendedor",
    priceLabel: "$700.000",
    featured: false,
    message: "Hola, quiero el Plan Emprendedor de CRM ByBluee por $700.000 COP.",
  },
];

const pricingFeatures = [
  "Chatbot para WhatsApp",
  "CRM de contactos",
  "Automatizaciones ilimitadas",
  "Campañas masivas",
  "Reportes avanzados",
  "Soporte premium",
];

export default async function ByBlueeLanding() {
  const supabase = await createClient();
  const { data: supportSetting } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "support_whatsapp_number")
    .maybeSingle();

  // Configurable at /admin/support — falls back to a placeholder until set.
  const salesWhatsappNumber = supportSetting?.value || "573000000000";
  const genericWaHref = `https://wa.me/${salesWhatsappNumber}?text=${encodeURIComponent(
    "Hola, quiero información sobre CRM ByBluee."
  )}`;

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3 sm:px-8">
          <Link href="/bybluee" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="ByBluee" className="h-8 w-8 rounded-lg" />
            <span className="text-base font-semibold tracking-tight text-foreground">
              BYBLUEE <span className="text-primary">CRM</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-muted md:flex">
            <a href="#beneficios" className="hover:text-foreground">
              Beneficios
            </a>
            <a href="#funciones" className="hover:text-foreground">
              Funciones
            </a>
            <a href="#precios" className="hover:text-foreground">
              Precios
            </a>
          </nav>

          <Link
            href="/login"
            className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
          >
            Acceder ahora
            <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-5 pb-16 pt-16 text-center sm:px-8 sm:pt-24">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[500px] bg-[radial-gradient(circle_at_top,_var(--primary)_0%,_transparent_60%)] opacity-[0.12]" />

        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-primary">
            <WhatsAppIcon size={13} />
            EL CRM PARA WHATSAPP BUSINESS
          </span>
        </Reveal>

        <Reveal delay={80}>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
            Convierte tu WhatsApp en una máquina de{" "}
            <span className="text-primary">ventas organizada</span>
          </h1>
        </Reveal>

        <Reveal delay={160}>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted sm:text-lg">
            Organiza tus conversaciones, automatiza seguimientos y responde más
            rápido con tu equipo — todo sobre la API oficial de WhatsApp Business.
          </p>
        </Reveal>

        <Reveal delay={220}>
          <div className="mx-auto mt-6 flex max-w-xl flex-wrap justify-center gap-3 text-xs text-muted">
            <span className="rounded-full border border-border px-3 py-1">
              Ahorra tiempo
            </span>
            <span className="rounded-full border border-border px-3 py-1">
              Responde más rápido
            </span>
            <span className="rounded-full border border-border px-3 py-1">
              Más ventas cada día
            </span>
          </div>
        </Reveal>

        <Reveal delay={280}>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={genericWaHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-colors hover:bg-primary-hover"
            >
              Empieza ahora
              <ArrowRight size={16} />
            </a>
          </div>
          <p className="mt-3 text-xs text-muted">
            ✦ Configuración en minutos. Te atendemos por WhatsApp.
          </p>
        </Reveal>

        <Reveal delay={340} className="mt-14">
          <HeroInboxMockup />
        </Reveal>
      </section>

      {/* Trust badges */}
      <section className="border-y border-border/60 bg-surface/40 py-10">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 sm:grid-cols-4 sm:px-8">
          {trustBadges.map((b, i) => (
            <Reveal key={b.title} delay={i * 80}>
              <div className="text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <b.icon size={18} />
                </div>
                <p className="mt-2 text-sm font-medium text-foreground">{b.title}</p>
                <p className="text-xs text-muted">{b.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Pain points */}
      <section className="mx-auto max-w-4xl px-5 py-20 sm:px-8">
        <Reveal>
          <p className="text-center text-xs font-semibold uppercase tracking-wide text-primary">
            ¿Te suena familiar?
          </p>
          <h2 className="mx-auto mt-2 max-w-xl text-center text-3xl font-semibold text-foreground sm:text-4xl">
            Cada día que pasa, se te escapan ventas
          </h2>
          <p className="mt-3 text-center text-muted">No es tu culpa. Falta un sistema.</p>
        </Reveal>

        <div className="mt-10 flex flex-col gap-3">
          {painPoints.map((p, i) => (
            <Reveal key={p} delay={i * 80}>
              <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
                <X size={16} className="shrink-0 text-red-400" />
                <p className="text-sm text-foreground">{p}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={painPoints.length * 80}>
          <div className="mt-6 flex items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-center">
            <Check size={16} className="shrink-0 text-primary" />
            <p className="text-sm font-medium text-foreground">
              ByBluee CRM organiza todo esto por ti.
            </p>
          </div>
        </Reveal>
      </section>

      {/* Benefits */}
      <section id="beneficios" className="bg-surface/40 py-20">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <Reveal>
            <p className="text-center text-xs font-semibold uppercase tracking-wide text-primary">
              Beneficios
            </p>
            <h2 className="mx-auto mt-2 max-w-2xl text-center text-3xl font-semibold text-foreground sm:text-4xl">
              Más ventas, menos esfuerzo
            </h2>
          </Reveal>

          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" id="funciones">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 100}>
                <div className="group h-full rounded-xl border border-border bg-surface p-6 transition-transform duration-300 hover:-translate-y-1 hover:border-primary/40">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary transition-transform duration-300 group-hover:scale-110">
                    <f.icon size={18} />
                  </div>
                  <h3 className="font-medium text-foreground">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted">{f.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Everything included */}
      <section className="mx-auto max-w-4xl px-5 py-20 sm:px-8">
        <Reveal>
          <p className="text-center text-xs font-semibold uppercase tracking-wide text-primary">
            Todo incluido
          </p>
          <h2 className="mx-auto mt-2 max-w-xl text-center text-3xl font-semibold text-foreground sm:text-4xl">
            ¿Qué incluye BYBLUEE CRM?
          </h2>
        </Reveal>

        <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {includedItems.map((item, i) => (
            <Reveal key={item} delay={(i % 4) * 80}>
              <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                  <Check size={13} />
                </div>
                <p className="text-sm text-foreground">{item}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="precios" className="bg-surface/40 py-20">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <Reveal>
            <h2 className="mx-auto max-w-2xl text-center text-3xl font-semibold text-foreground sm:text-4xl">
              Elige tu plan y comienza hoy
            </h2>
          </Reveal>

          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {pricingPlans.map((plan, i) => {
              const waHref = `https://wa.me/${salesWhatsappNumber}?text=${encodeURIComponent(plan.message)}`;
              return (
                <Reveal key={plan.name} delay={i * 100}>
                  <div
                    className={`relative flex h-full flex-col rounded-2xl border p-6 ${
                      plan.featured
                        ? "border-primary bg-primary/5"
                        : "border-border bg-surface"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
                      {plan.featured && (
                        <span className="flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold text-white">
                          <ZapIcon size={10} />
                          Más popular
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-3xl font-semibold text-foreground">
                        {plan.priceLabel}
                      </span>
                      <span className="text-sm text-muted">COP</span>
                    </div>
                    <p className="text-xs text-muted">Pago único • Acceso de por vida</p>
                    <ul className="mt-5 flex flex-1 flex-col gap-2 text-sm text-muted">
                      {pricingFeatures.map((item) => (
                        <li key={item} className="flex items-center gap-2">
                          <Check size={13} className="shrink-0 text-success" />
                          {item}
                        </li>
                      ))}
                    </ul>
                    <a
                      href={waHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-6 flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
                    >
                      <WhatsAppIcon size={14} />
                      Comenzar ahora
                    </a>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-4xl px-5 py-24 text-center sm:px-8">
        <Reveal>
          <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">
            No esperes más para organizar tu WhatsApp
          </h2>
          <p className="mx-auto mt-4 max-w-md text-muted">
            Empieza hoy y convierte más conversaciones en ventas.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a
              href={genericWaHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-colors hover:bg-primary-hover"
            >
              Empieza ahora
              <ArrowRight size={16} />
            </a>
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 rounded-lg border border-border px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface"
            >
              Acceder ahora
            </Link>
          </div>
          <p className="mt-3 text-xs text-muted">
            Te atendemos por WhatsApp • Configuración en minutos
          </p>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-5 text-center sm:px-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="ByBluee" className="h-9 w-9 rounded-lg" />
          <SocialLinks />
          <p className="text-xs text-muted">
            © {new Date().getFullYear()} BYBLUEE CRM — Automatización inteligente para
            WhatsApp
          </p>
          <div className="flex items-center gap-4 text-xs text-muted">
            <Link href="/login" className="hover:text-foreground">
              Iniciar sesión
            </Link>
            <Link href="/privacidad" className="hover:text-foreground">
              Política de privacidad
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
