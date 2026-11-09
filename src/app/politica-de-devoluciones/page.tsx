import Link from "next/link";
import {
  AlertTriangle,
  BookOpen,
  CalendarX,
  CheckCircle2,
  Clock,
  Eye,
  Mail,
  Search,
  ShieldAlert,
  ShieldCheck,
  Wifi,
  XCircle,
} from "lucide-react";

export const metadata = {
  title: "Política de devoluciones — ByBluee",
  description: "Cuándo aplica la devolución del dinero en CRM Bybluee, cuándo no y cómo solicitarla.",
};

/** Lo mismo que usan Juanes y los terminos: si cambia aqui, cambiar alla tambien. */
const NO_APLICA = [
  {
    Icono: BookOpen,
    titulo: "No saber usar la herramienta",
    texto: "La plataforma incluye capacitaciones y acompañamiento para que aprendas a usarla.",
  },
  {
    Icono: Eye,
    titulo: "No te gustó cómo se ve",
    texto: "El diseño o la forma en que está organizada la plataforma no son causa de devolución.",
  },
  {
    Icono: ShieldAlert,
    titulo: "Problemas con Facebook o Meta",
    texto:
      "Que no te deje conectar, que bloquee o restrinja tu cuenta o tu número, que no apruebe tus plantillas o que limite tus envíos. Son decisiones de Meta, externas a CRM Bybluee.",
  },
  {
    Icono: Search,
    titulo: "No es lo que buscabas",
    texto:
      "Al comprar declaras que conociste la información del producto y aceptas el riesgo de conocer la plataforma.",
  },
  {
    Icono: Wifi,
    titulo: "Fallas de tu internet, equipo o línea",
    texto: "Problemas de tu conexión, tu computador, tu celular o tu operador telefónico.",
  },
  {
    Icono: CalendarX,
    titulo: "Pasaron los 7 días",
    texto: "La solicitud debe hacerse dentro de los 7 días calendario siguientes al pago.",
  },
  {
    Icono: XCircle,
    titulo: "Incumplir los términos",
    texto: "Cuentas suspendidas por incumplir nuestros términos o las políticas de WhatsApp.",
  },
];

const PASOS = [
  {
    titulo: "Escríbenos",
    texto: "Envía un correo a soporte@crmbybluee.blue, dentro del plazo, con el nombre de tu cuenta y las fechas de la falla.",
  },
  { titulo: "Revisamos tu caso", texto: "Verificamos la falla en nuestros registros y te respondemos en máximo 5 días hábiles." },
  {
    titulo: "Te devolvemos el dinero",
    texto: "Si aplica, hacemos la devolución por el mismo medio de pago o por transferencia, en máximo 15 días hábiles.",
  },
];

export default function PoliticaDeDevolucionesPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="h-8 w-8 rounded-lg" />
            <span className="font-dash-display text-lg font-bold">ByBluee</span>
          </Link>
          <Link href="/terminos" className="text-sm text-muted hover:text-foreground">
            Términos y condiciones
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-20">
        <section className="py-14 text-center md:py-20">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted">
            <ShieldCheck size={14} /> Compra con reglas claras
          </span>
          <h1 className="mx-auto mt-4 max-w-3xl font-dash-display text-[clamp(32px,5vw,52px)] font-bold leading-[1.05] tracking-[-.03em] text-balance">
            Política de devoluciones
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-muted text-balance">
            Queremos que compres con tranquilidad y sabiendo exactamente cuándo aplica una devolución. Esta es la única
            regla, sin letra pequeña.
          </p>
          <p className="mt-3 text-xs text-muted">Última actualización: noviembre de 2026</p>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          {[
            { valor: "7 días", texto: "para solicitarla, desde el pago" },
            { valor: "+3 días", texto: "seguidos sin funcionar por falla nuestra" },
            { valor: "1 sola causa", texto: "que la plataforma no funcione" },
          ].map((d) => (
            <div key={d.valor} className="rounded-[13px] border border-border bg-surface p-5 text-center">
              <p className="font-dash-display text-[28px] font-bold tracking-[-.02em]">{d.valor}</p>
              <p className="mt-1 text-sm text-muted">{d.texto}</p>
            </div>
          ))}
        </section>

        <section className="mt-12 rounded-[16px] border border-success/40 bg-success/5 p-6 md:p-8">
          <h2 className="flex items-center gap-2 font-dash-display text-[clamp(22px,3vw,30px)] font-bold tracking-[-.02em]">
            <CheckCircle2 className="shrink-0 text-success" size={26} /> Cuándo sí hay devolución
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed">
            Solo devolvemos el dinero si, <strong>dentro de los 7 días calendario siguientes al pago</strong>,{" "}
            <strong>CRM Bybluee deja de funcionar por una falla de nuestra plataforma durante más de 3 días seguidos</strong> y
            no logramos restablecer el servicio.
          </p>
          <p className="mt-3 text-sm text-muted">Es la única causa de devolución.</p>
        </section>

        <section className="mt-12">
          <h2 className="flex items-center gap-2 font-dash-display text-[clamp(22px,3vw,30px)] font-bold tracking-[-.02em]">
            <XCircle className="shrink-0 text-red-400" size={26} /> Cuándo no hay devolución
          </h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {NO_APLICA.map(({ Icono, titulo, texto }) => (
              <div key={titulo} className="rounded-[13px] border border-border bg-surface p-5">
                <Icono size={20} className="text-muted" aria-hidden="true" />
                <h3 className="mt-3 text-[15px] font-semibold">{titulo}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{texto}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12 rounded-[16px] border border-border bg-surface p-6 md:p-8">
          <h2 className="flex items-center gap-2 font-dash-display text-[clamp(22px,3vw,30px)] font-bold tracking-[-.02em]">
            <AlertTriangle className="shrink-0 text-warning" size={24} /> Cuánto se devuelve
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed">
            Se devuelve el valor pagado por el plan, <strong>descontando los gastos administrativos</strong> y{" "}
            <strong>las comisiones del medio de pago</strong> que usaste (pasarela, transferencia o similar).
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            No se devuelven los costos que no cobra CRM Bybluee, como los cobros de Meta por las plantillas de WhatsApp ni
            el consumo de tu proveedor de inteligencia artificial.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="flex items-center gap-2 font-dash-display text-[clamp(22px,3vw,30px)] font-bold tracking-[-.02em]">
            <Clock className="shrink-0 text-primary" size={24} /> Cómo solicitarla
          </h2>
          <ol className="mt-6 grid gap-3 md:grid-cols-3">
            {PASOS.map((p, i) => (
              <li key={p.titulo} className="rounded-[13px] border border-border bg-surface p-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                  {i + 1}
                </span>
                <h3 className="mt-3 text-[15px] font-semibold">{p.titulo}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{p.texto}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12 rounded-[16px] border border-border p-6 md:p-8">
          <h2 className="font-dash-display text-[clamp(20px,2.6vw,26px)] font-bold tracking-[-.02em]">Aceptación</h2>
          <p className="mt-3 text-[15px] leading-relaxed">
            Al pagar y activar tu cuenta aceptas esta política. <strong>El servicio empieza a prestarse desde la activación, con
            tu consentimiento.</strong> Te recomendamos revisar la información de los planes y resolver tus dudas antes de
            comprar.
          </p>
          <p className="mt-3 text-sm text-muted">
            Esta política hace parte de nuestros{" "}
            <Link href="/terminos" className="text-primary hover:underline">
              términos y condiciones
            </Link>
            .
          </p>
        </section>

        <section className="mt-12 flex flex-col items-center gap-3 rounded-[16px] bg-surface p-8 text-center">
          <h2 className="font-dash-display text-[clamp(20px,2.6vw,26px)] font-bold tracking-[-.02em]">¿Tienes dudas antes de comprar?</h2>
          <p className="max-w-xl text-sm text-muted">Escríbenos y te explicamos todo lo que necesites saber de la plataforma.</p>
          <a
            href="mailto:soporte@crmbybluee.blue"
            className="mt-1 inline-flex items-center gap-2 rounded-[10px] bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover"
          >
            <Mail size={16} /> soporte@crmbybluee.blue
          </a>
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center text-[12.5px] text-muted">
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/" className="hover:text-foreground">Inicio</Link>
          <Link href="/terminos" className="hover:text-foreground">Términos</Link>
          <Link href="/privacidad" className="hover:text-foreground">Privacidad</Link>
        </div>
      </footer>
    </div>
  );
}
