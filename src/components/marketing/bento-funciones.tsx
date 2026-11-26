"use client";

import { useRef, type MouseEvent, type ReactNode } from "react";
import { Bell, Bot, CalendarClock, Megaphone, MessageSquareReply, Moon, Smartphone, Users, Zap } from "lucide-react";
import { Reveal } from "@/components/marketing/reveal";

/**
 * "Qué hace por ti" en rejilla bento (25 nov 2026). Adaptado del componente
 * "Bento Grid" de 21st.dev (@my/bento-grid): tarjetas de distinto tamaño, un
 * brillo que sigue el cursor en el borde y una ilustracion pequena por funcion.
 * Sin la libreria de animacion del original: el brillo es CSS (variables --x/--y)
 * y la entrada escalonada usa Reveal, como el resto de la pagina.
 */

type Funcion = {
  icono: ReactNode;
  titulo: string;
  texto: string;
  /** Columnas que ocupa en pantallas anchas (de 4). */
  ancho: 1 | 2;
  visual?: ReactNode;
};

function Tarjeta({ f }: { f: Funcion }) {
  const ref = useRef<HTMLElement>(null);
  const mover = (e: MouseEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--x", `${e.clientX - r.left}px`);
    el.style.setProperty("--y", `${e.clientY - r.top}px`);
  };
  // Al salir, el brillo se va fuera de la tarjeta y el borde vuelve a su color.
  const salir = () => {
    ref.current?.style.setProperty("--x", "-400px");
    ref.current?.style.setProperty("--y", "-400px");
  };
  return (
    <article
      ref={ref}
      onMouseMove={mover}
      onMouseLeave={salir}
      className="group/bento relative isolate flex h-full flex-col overflow-hidden rounded-2xl border border-transparent p-5 transition-transform duration-300 motion-safe:hover:-translate-y-1"
      // El brillo vive SOLO en el borde (25 nov 2026: encima del texto tapaba las
      // letras). El fondo de la tarjeta se pinta en el padding-box y el degradado
      // que sigue al cursor solo asoma por el borde de 1px (border-box).
      style={{
        background:
          "linear-gradient(var(--background), var(--background)) padding-box, radial-gradient(170px circle at var(--x, -400px) var(--y, -400px), var(--primary), var(--border) 75%) border-box",
      }}
    >
      {/* Resplandor muy suave detras del contenido, nunca encima de las letras. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 [@media(hover:hover)]:group-hover/bento:opacity-100"
        style={{ background: "radial-gradient(220px circle at var(--x, -400px) var(--y, -400px), #1ba84a12, transparent 70%)" }}
      />
      {f.visual && (
        <div aria-hidden className="mb-4 flex min-h-[96px] flex-1 items-center justify-center transition-transform duration-500 motion-safe:group-hover/bento:-translate-y-1">
          {f.visual}
        </div>
      )}
      <div className={f.visual ? "" : "mt-auto"}>
        <div className="flex items-center gap-2.5">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary [&_svg]:size-4">{f.icono}</span>
          <h3 className="font-dash-display text-[17px] font-semibold leading-snug">{f.titulo}</h3>
        </div>
        <p className="mt-2 text-[13.5px] leading-[1.55] text-muted">{f.texto}</p>
      </div>
    </article>
  );
}

/* ---------------------------------------------------------------- ilustraciones */

function VisualEquipo() {
  const personas = [
    ["SM", "#1ba84a"],
    ["LP", "#4a9eff"],
    ["AR", "#f59e0b"],
    ["JC", "#a855f7"],
  ];
  return (
    <div className="flex w-full max-w-[300px] flex-col gap-2">
      <div className="flex items-center">
        {personas.map(([ini, c]) => (
          <span key={ini} className="-ml-2 flex size-9 items-center justify-center rounded-full border-2 border-background text-[11px] font-bold text-white first:ml-0" style={{ background: c }}>
            {ini}
          </span>
        ))}
        <span className="-ml-2 flex size-9 items-center justify-center rounded-full border-2 border-background bg-surface-hover text-[11px] font-semibold text-muted">+8</span>
        <span className="ml-3 rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-semibold text-primary">1 número</span>
      </div>
      <div className="rounded-lg border border-border bg-surface/70 px-3 py-2 text-[11.5px] text-muted">
        <b className="text-foreground">Laura</b> tomó el chat de <b className="text-foreground">Tienda Andina</b>
      </div>
    </div>
  );
}

function VisualAutomatizacion() {
  return (
    <div className="flex flex-col items-center gap-1.5 text-[11px]">
      <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-muted">“hola”</span>
      <span className="h-3 w-px bg-primary/60" />
      <span className="rounded-full bg-primary/15 px-2.5 py-1 font-semibold text-primary">Bienvenida + asesor</span>
    </div>
  );
}

function VisualSeguimiento() {
  return (
    <div className="flex w-full max-w-[160px] flex-col gap-1.5 text-[11px]">
      {["2 h", "1 día", "3 días"].map((t, i) => (
        <div key={t} className="flex items-center justify-between rounded-md border border-border bg-surface/70 px-2 py-1 text-muted">
          <span>Insistir</span>
          <span className={i === 2 ? "font-semibold text-primary" : ""}>{t}</span>
        </div>
      ))}
    </div>
  );
}

function VisualCampanas() {
  const barras: [string, number][] = [
    ["Enviados", 100],
    ["Entregados", 94],
    ["Leídos", 71],
  ];
  return (
    <div className="flex w-full max-w-[170px] flex-col gap-2 text-[10.5px] text-muted">
      {barras.map(([n, v]) => (
        <div key={n}>
          <div className="mb-0.5 flex justify-between"><span>{n}</span><span className="text-foreground">{v}%</span></div>
          <div className="h-1.5 rounded-full bg-surface-hover">
            <div className="h-1.5 rounded-full bg-primary" style={{ width: `${v}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function VisualIa() {
  return (
    <div className="flex w-full max-w-[320px] flex-col gap-2 text-[12px]">
      <div className="max-w-[80%] self-start rounded-2xl rounded-bl-sm border border-border bg-surface px-3 py-2 text-muted">¿Tienen envíos a Medellín?</div>
      <div className="max-w-[85%] self-end rounded-2xl rounded-br-sm bg-primary/90 px-3 py-2 text-white">
        ¡Sí! Llega en 2 días hábiles. ¿Te comparto el catálogo? 😊
      </div>
      <span className="flex items-center gap-1 self-end text-[10.5px] text-primary"><Bot size={11} /> Respondió el agente de IA · 3 a. m.</span>
    </div>
  );
}

function VisualApp() {
  return (
    <div className="relative h-[100px] w-[62px] rounded-[14px] border-2 border-border bg-surface">
      <span className="absolute left-1/2 top-1.5 h-1 w-5 -translate-x-1/2 rounded-full bg-border" />
      <div className="absolute inset-x-1.5 top-4 flex items-center gap-1 rounded-md bg-primary/20 px-1 py-1">
        <Bell size={8} className="shrink-0 text-primary" />
        <span className="h-1 flex-1 rounded-full bg-primary/60" />
      </div>
      <div className="absolute inset-x-1.5 top-10 space-y-1">
        <span className="block h-1 rounded-full bg-border" />
        <span className="block h-1 w-3/4 rounded-full bg-border" />
        <span className="block h-1 w-1/2 rounded-full bg-border" />
      </div>
    </div>
  );
}

function VisualAgenda() {
  return (
    <div className="grid w-full max-w-[300px] grid-cols-7 gap-1 text-center text-[10px] text-muted">
      {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
        <span key={i}>{d}</span>
      ))}
      {Array.from({ length: 14 }, (_, i) => (
        <span
          key={i}
          className={`rounded-md py-1 ${i === 3 || i === 9 ? "bg-primary text-white" : i === 6 ? "bg-primary/20 text-primary" : "bg-surface-hover/70"}`}
        >
          {i + 10}
        </span>
      ))}
    </div>
  );
}

function VisualSiempre() {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary"><Moon size={20} /></span>
      <div className="text-[11.5px] text-muted">
        <p className="font-dash-display text-2xl font-bold leading-none text-foreground">24/7</p>
        noches, fines de semana y festivos
      </div>
    </div>
  );
}

const FUNCIONES: Funcion[] = [
  {
    icono: <Users />,
    titulo: "Tu equipo en el mismo número",
    texto: "Añade personas a tu equipo: cada una entra con su usuario, responde desde el mismo número y recibe los chats que le asignes. Tú lo ves todo.",
    ancho: 2,
    visual: <VisualEquipo />,
  },
  {
    icono: <Zap />,
    titulo: "Automatizaciones",
    texto: "Bienvenida, palabras clave, botones y asignación automática desde el primer mensaje.",
    ancho: 1,
    visual: <VisualAutomatizacion />,
  },
  {
    icono: <MessageSquareReply />,
    titulo: "Seguimientos",
    texto: "Si el cliente deja de responder, el CRM insiste con el mensaje y el tiempo que definas.",
    ancho: 1,
    visual: <VisualSeguimiento />,
  },
  {
    icono: <Megaphone />,
    titulo: "Campañas masivas",
    texto: "Plantillas aprobadas por Meta, segmentadas por etiqueta, con reporte de entrega y lectura.",
    ancho: 1,
    visual: <VisualCampanas />,
  },
  {
    icono: <Bot />,
    titulo: "Agente de IA",
    texto: "Responde con tu tono cuando no hay nadie, y entrega la conversación a una persona cuando toca.",
    ancho: 2,
    visual: <VisualIa />,
  },
  {
    icono: <Smartphone />,
    titulo: "App móvil",
    texto: "Responde desde el celular con la misma bandeja, notificaciones al instante y notas de voz. Tu equipo atiende desde donde esté.",
    ancho: 1,
    visual: <VisualApp />,
  },
  {
    icono: <CalendarClock />,
    titulo: "Agenda y reportes",
    texto: "Recordatorios por cliente en un calendario y reportes de tiempos de respuesta y ventas.",
    ancho: 2,
    visual: <VisualAgenda />,
  },
  {
    icono: <Moon />,
    titulo: "Activo 24/7",
    texto: "Nunca se apaga: responde, asigna e insiste de noche, fines de semana y festivos, aunque nadie esté conectado.",
    ancho: 2,
    visual: <VisualSiempre />,
  },
];

export function BentoFunciones() {
  return (
    <div className="grid grid-flow-row-dense gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
      {FUNCIONES.map((f, i) => (
        <Reveal key={f.titulo} delay={i * 60} className={f.ancho === 2 ? "sm:col-span-2" : ""}>
          <Tarjeta f={f} />
        </Reveal>
      ))}
    </div>
  );
}
