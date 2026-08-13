import Link from "next/link";
import { ArrowRight, Clock, MessageSquareOff, Megaphone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Reveal } from "@/components/reveal";
import { HeroInboxMockup } from "@/components/hero-inbox-mockup";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { SocialLinks } from "@/components/social-links";
import { features, steps } from "@/lib/landing-content";

const sectors = [
  "Inmobiliarias",
  "Clínicas y salud",
  "Agencias digitales",
  "Comercios y tiendas",
  "Estudios contables",
  "Coaches y consultores",
  "Educación",
  "Estudios jurídicos",
];

export default async function Home() {
  const supabase = await createClient();
  const { data: plans } = await supabase
    .from("plans")
    .select("*")
    .eq("is_active", true)
    .order("price_cents");

  const { data: supportSetting } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "support_whatsapp_number")
    .maybeSingle();

  // Configurable at /admin/support — falls back to a placeholder until set.
  const salesWhatsappNumber = supportSetting?.value || "573000000000";
  const waHref = (text: string) =>
    `https://wa.me/${salesWhatsappNumber}?text=${encodeURIComponent(text)}`;
  const genericWaHref = waHref("Hola, quiero información sobre CRM ByBluee.");

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3 sm:px-8">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="ByBluee" className="h-8 w-8 rounded-lg" />
            <span className="text-base font-semibold text-foreground">ByBluee</span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-muted md:flex">
            <a href="#beneficios" className="hover:text-foreground">
              Beneficios
            </a>
            <a href="#funcionalidades" className="hover:text-foreground">
              Funcionalidades
            </a>
            <a href="#como-funciona" className="hover:text-foreground">
              Cómo funciona
            </a>
            <a href="#precios" className="hover:text-foreground">
              Precios
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <SocialLinks className="hidden md:flex" />
            <Link
              href="/login"
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface"
            >
              Iniciar sesión
            </Link>
            <a
              href={genericWaHref}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover sm:block"
            >
              Quiero mi CRM
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-5 pb-20 pt-14 sm:px-8 sm:pb-28 sm:pt-20">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[500px] bg-[radial-gradient(circle_at_top,_var(--primary)_0%,_transparent_60%)] opacity-[0.12]" />

        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div>
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
                <WhatsAppIcon size={13} className="text-success" />
                WhatsApp Business Cloud API oficial
              </span>
            </Reveal>

            <Reveal delay={80}>
              <h1 className="mt-5 text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
                Tu WhatsApp está lleno de clientes que{" "}
                <span className="text-primary">todavía no cierras</span>
              </h1>
            </Reveal>

            <Reveal delay={160}>
              <p className="mt-5 max-w-lg text-base text-muted sm:text-lg">
                ByBluee convierte tu WhatsApp Business en un CRM completo: bandeja
                organizada, campañas, automatizaciones y agentes de respuesta — todo
                sobre la API oficial de Meta.
              </p>
            </Reveal>

            <Reveal delay={240}>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href={genericWaHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-colors hover:bg-primary-hover"
                >
                  Quiero mi CRM
                  <ArrowRight size={16} />
                </a>
                <Link
                  href="/login"
                  className="flex items-center justify-center gap-2 rounded-lg border border-border px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface"
                >
                  Ya tengo cuenta
                </Link>
              </div>
              <p className="mt-3 text-xs text-muted">
                Te atendemos por WhatsApp. Configuración en minutos.
              </p>
            </Reveal>
          </div>

          <Reveal delay={200}>
            <HeroInboxMockup />
          </Reveal>
        </div>
      </section>

      {/* Sectors marquee */}
      <div className="border-y border-border/60 bg-surface/50 py-4">
        <p className="mb-3 text-center text-xs uppercase tracking-wide text-muted">
          Usado por negocios de estos sectores
        </p>
        <div className="overflow-hidden">
          <div className="marquee-track flex w-max gap-8 whitespace-nowrap">
            {[...sectors, ...sectors].map((s, i) => (
              <span key={i} className="text-sm text-muted">
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Problem */}
      <section id="beneficios" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <Reveal>
          <p className="text-center text-xs font-semibold uppercase tracking-wide text-primary">
            El problema real
          </p>
          <h2 className="mx-auto mt-2 max-w-2xl text-center text-3xl font-semibold text-foreground sm:text-4xl">
            Responder desde el celular no escala
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-muted">
            Sin un sistema, no sabes quién está listo para comprar, quién necesita
            seguimiento y quién ya se enfrió. Las oportunidades se pierden en el
            scroll de chats.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              icon: MessageSquareOff,
              title: "Conversaciones sin dueño",
              text: "Varios vendedores contestan el mismo número sin saber qué se habló antes.",
            },
            {
              icon: Clock,
              title: "Seguimientos que se olvidan",
              text: "Un cliente dice 'escríbeme mañana' y ese mensaje se pierde entre cien más.",
            },
            {
              icon: Megaphone,
              title: "Sin forma de escalar",
              text: "Enviar plantillas o novedades a toda tu base a mano no es sostenible.",
            },
          ].map((p, i) => (
            <Reveal key={p.title} delay={i * 100}>
              <div className="h-full rounded-xl border border-border bg-surface p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-red-400/15 text-red-400">
                  <p.icon size={18} />
                </div>
                <h3 className="font-medium text-foreground">{p.title}</h3>
                <p className="mt-2 text-sm text-muted">{p.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="funcionalidades" className="bg-surface/40 py-20">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <Reveal>
            <p className="text-center text-xs font-semibold uppercase tracking-wide text-primary">
              Todo en un solo lugar
            </p>
            <h2 className="mx-auto mt-2 max-w-2xl text-center text-3xl font-semibold text-foreground sm:text-4xl">
              Lo que necesitas para vender por WhatsApp
            </h2>
          </Reveal>

          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

      {/* How it works */}
      <section id="como-funciona" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <Reveal>
          <p className="text-center text-xs font-semibold uppercase tracking-wide text-primary">
            Cómo funciona
          </p>
          <h2 className="mx-auto mt-2 max-w-2xl text-center text-3xl font-semibold text-foreground sm:text-4xl">
            De WhatsApp desordenado a CRM en 3 pasos
          </h2>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={s.title} delay={i * 120}>
              <div className="relative text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  <s.icon size={24} />
                </div>
                <span className="mt-4 block text-xs font-semibold text-primary">
                  Paso {i + 1}
                </span>
                <h3 className="mt-1 font-medium text-foreground">{s.title}</h3>
                <p className="mt-2 text-sm text-muted">{s.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Pricing */}
      {plans && plans.length > 0 && (
        <section id="precios" className="bg-surface/40 py-20">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <Reveal>
              <p className="text-center text-xs font-semibold uppercase tracking-wide text-primary">
                Precios
              </p>
              <h2 className="mx-auto mt-2 max-w-2xl text-center text-3xl font-semibold text-foreground sm:text-4xl">
                Un plan para cada etapa de tu negocio
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-center text-muted">
                Escríbenos por WhatsApp y te ayudamos a activar el plan que
                necesitas.
              </p>
            </Reveal>

            <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan, i) => (
                <Reveal key={plan.id} delay={i * 100}>
                  <div className="flex h-full flex-col rounded-2xl border border-border bg-surface p-6">
                    <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-3xl font-semibold text-foreground">
                        ${(plan.price_cents / 100).toLocaleString("es-CO")}
                      </span>
                      <span className="text-sm text-muted">
                        {plan.currency} /{" "}
                        {plan.billing_cycle === "yearly" ? "año" : "mes"}
                      </span>
                    </div>
                    <a
                      href={waHref(
                        `Hola, quiero el plan ${plan.name} de CRM ByBluee por $${(plan.price_cents / 100).toLocaleString("es-CO")} ${plan.currency}.`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-6 rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
                    >
                      Empezar ahora
                    </a>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Final CTA */}
      <section className="mx-auto max-w-4xl px-5 py-24 text-center sm:px-8">
        <Reveal>
          <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">
            ¿Listo para organizar tus ventas por WhatsApp?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-muted">
            Conecta tu número, organiza tu bandeja y empieza a automatizar hoy mismo.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a
              href={genericWaHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-colors hover:bg-primary-hover"
            >
              Quiero activar mi CRM
              <ArrowRight size={16} />
            </a>
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 rounded-lg border border-border px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface"
            >
              Iniciar sesión
            </Link>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-5 text-center sm:px-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="ByBluee" className="h-9 w-9 rounded-lg" />
          <SocialLinks />
          <p className="text-xs text-muted">
            © {new Date().getFullYear()} ByBluee. Todos los derechos reservados.
          </p>
          <Link href="/privacidad" className="text-xs text-muted hover:text-foreground">
            Política de privacidad
          </Link>
        </div>
      </footer>
    </div>
  );
}
