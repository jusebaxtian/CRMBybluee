"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Piezas animadas de la pagina principal ("Bandeja viva"): la bandeja que
 * conversa sola, contadores, cinta continua, flujo que se enciende paso a
 * paso, el agente de IA tecleando y los testimonios que rotan. Todo
 * respeta prefers-reduced-motion.
 */

function reduceMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* ---------- Contador ---------- */
export function Contador({ hasta, prefijo = "", sufijo = "", className = "" }: { hasta: number; prefijo?: string; sufijo?: string; className?: string }) {
  const ref = useRef<HTMLElement>(null);
  const [valor, setValor] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (es) => {
        if (!es[0].isIntersecting) return;
        io.disconnect();
        if (reduceMotion()) {
          setValor(hasta);
          return;
        }
        const t0 = performance.now();
        const dur = 1400;
        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / dur);
          setValor(Math.round(hasta * (1 - Math.pow(1 - p, 3))));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasta]);
  return (
    <b ref={ref} className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {prefijo}
      {valor.toLocaleString("es-CO")}
      {sufijo}
    </b>
  );
}

/* ---------- Cinta continua ---------- */
export function Cinta({ items, velocidad = 28, className = "" }: { items: React.ReactNode[]; velocidad?: number; className?: string }) {
  return (
    <div className={`overflow-hidden ${className}`} style={{ maskImage: "linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)", WebkitMaskImage: "linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)" }}>
      <div className="viva-cinta flex w-max gap-11" style={{ animationDuration: `${velocidad}s` }}>
        {[...items, ...items].map((it, i) => (
          <span key={i} className="flex shrink-0 items-center gap-2 whitespace-nowrap">
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- Bandeja viva ---------- */
const GUION: [("in" | "bot" | "out"), string, string][] = [
  ["in", "Hola, ¿tienen envío a Cali?", "9:41"],
  ["bot", "¡Hola Laura! 👋 Sí, enviamos a todo el país. ¿Qué producto te interesa?", "Respuesta automática · 9:41"],
  ["in", "El filtro de agua grande", "9:43"],
  ["out", "Claro, te comparto precio y foto ahora mismo 📷", "Ana · 9:44 ✓✓"],
  ["in", "Perfecto, ¿cómo pago?", "9:46"],
  ["out", "Te envío el link de pago 👇", "Ana · 9:46 ✓✓"],
];

const LISTA = [
  ["JR", "Jhon Rojas", "Listo, ya pagué 🙌", ""],
  ["MP", "Mariana P.", "🎤 Nota de voz", "1"],
  ["CT", "Carlos T.", "Gracias!", ""],
  ["DS", "Diego S.", "Cotización recibida", ""],
];

export function BandejaViva() {
  const [n, setN] = useState(0);
  const [typing, setTyping] = useState(false);
  const [badge, setBadge] = useState(3);

  useEffect(() => {
    let vivo = true;
    let t: ReturnType<typeof setTimeout>;
    const rapido = reduceMotion();
    function paso(i: number) {
      if (!vivo) return;
      if (i >= GUION.length) {
        t = setTimeout(() => {
          setN(0);
          paso(0);
        }, 3500);
        return;
      }
      const [k] = GUION[i];
      if (k === "in") setTyping(true);
      t = setTimeout(
        () => {
          if (!vivo) return;
          setTyping(false);
          setN(i + 1);
          if (k === "in") setBadge((b) => b + 1);
          t = setTimeout(() => paso(i + 1), 1300);
        },
        rapido ? 0 : k === "in" ? 900 : 1400
      );
    }
    paso(0);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, []);

  const visibles = GUION.slice(0, n);
  const ultimo = visibles[visibles.length - 1]?.[1] ?? "¿Tienen envío a Cali?";

  return (
    <div className="viva-inbox grid min-h-[400px] overflow-hidden rounded-[18px] border border-[#223028] bg-[#111814] shadow-[0_40px_100px_rgba(0,0,0,0.65),0_0_0_1px_#1ba84a22] sm:grid-cols-[210px_1fr]" aria-hidden="true">
      <div className="hidden border-r border-[#223028] bg-[#0f1612] p-2.5 sm:block">
        <h6 className="mx-1.5 mb-2.5 mt-1 flex justify-between text-[11px] uppercase tracking-[.1em] text-[#7c8a82]">
          Conversaciones <em className="rounded-full bg-primary px-1.5 text-[10px] not-italic text-white">{badge}</em>
        </h6>
        <div className="flex items-center gap-2 rounded-[10px] bg-[#1ba84a22] p-2 text-xs">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#2a3630] text-[11px] font-extrabold text-[#cfe3d6]">LG</div>
          <p className="m-0 leading-tight">
            Laura Gómez
            <small className="block max-w-[110px] truncate text-[#7c8a82]">{ultimo}</small>
          </p>
          <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-extrabold text-white">2</span>
        </div>
        {LISTA.map(([av, nombre, prev, num]) => (
          <div key={nombre} className="flex items-center gap-2 rounded-[10px] p-2 text-xs">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#2a3630] text-[11px] font-extrabold text-[#cfe3d6]">{av}</div>
            <p className="m-0 leading-tight">
              {nombre}
              <small className="block max-w-[110px] truncate text-[#7c8a82]">{prev}</small>
            </p>
            {num && <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-extrabold text-white">{num}</span>}
          </div>
        ))}
      </div>
      <div className="flex flex-col bg-[#0d1310]">
        <header className="flex items-center justify-between border-b border-[#223028] px-3.5 py-2.5 text-[12.5px]">
          <b>Laura Gómez</b>
          <span className="flex items-center gap-1.5 text-[11px] text-primary">
            <i className="viva-blink inline-block h-1.5 w-1.5 rounded-full bg-primary" />
            Asignado a Ana
          </span>
        </header>
        <div className="flex min-h-[250px] flex-1 flex-col gap-2 p-3.5">
          {visibles.map(([k, txt, meta], i) => (
            <div
              key={i}
              className={`viva-msg max-w-[80%] rounded-[12px] px-[11px] py-2 text-[12.5px] leading-[1.35] ${
                k === "in"
                  ? "self-start rounded-bl-[4px] bg-[#1c2620]"
                  : k === "out"
                    ? "self-end rounded-br-[4px] bg-primary text-white"
                    : "self-end border border-dashed border-[#1ba84a88] bg-[#0f1a13] text-[#cfe3d6]"
              }`}
            >
              {txt}
              <i className="mt-[3px] block text-[10px] not-italic opacity-65">{meta}</i>
            </div>
          ))}
          {typing && (
            <div className="flex gap-1 self-start rounded-[12px] bg-[#1c2620] px-3 py-2">
              <b className="viva-dot h-1.5 w-1.5 rounded-full bg-[#7c8a82]" />
              <b className="viva-dot h-1.5 w-1.5 rounded-full bg-[#7c8a82]" style={{ animationDelay: ".15s" }} />
              <b className="viva-dot h-1.5 w-1.5 rounded-full bg-[#7c8a82]" style={{ animationDelay: ".3s" }} />
            </div>
          )}
        </div>
        <div className="flex justify-between border-t border-[#223028] px-3.5 py-2.5 text-xs text-[#7c8a82]">
          <span>Escribe un mensaje…</span>
          <span>⏰ 📎 🎤</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- Flujo ---------- */
const PASOS = [
  ["💬", "El cliente escribe", "Por anuncio, por tu web o porque te tenía guardado."],
  ["⚡", "ByBluee responde en 2 seg", "Bienvenida y respuesta al instante, 24/7."],
  ["👤", "Se asigna a tu equipo", "Cae en la bandeja de la persona correcta, en el computador o en su celular."],
  ["↻", "Seguimiento", "Si se queda callado, el sistema insiste por ti."],
  ["✅", "Venta", "Etiqueta, reporte y el próximo cliente ya está entrando."],
];

export function Flujo() {
  const ref = useRef<HTMLDivElement>(null);
  const [activo, setActivo] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let iv: ReturnType<typeof setInterval> | null = null;
    const io = new IntersectionObserver(
      (es) => {
        if (!es[0].isIntersecting) return;
        io.disconnect();
        if (reduceMotion()) {
          setActivo(PASOS.length - 1);
          return;
        }
        iv = setInterval(() => setActivo((a) => (a + 1) % PASOS.length), 1500);
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (iv) clearInterval(iv);
    };
  }, []);
  return (
    <div ref={ref} className="relative mt-2 grid gap-5 sm:grid-cols-5 sm:gap-3">
      <div className="absolute left-[8%] right-[8%] top-[26px] hidden h-0.5 bg-border sm:block" />
      <div className="absolute left-[8%] top-[26px] hidden h-0.5 bg-primary transition-[width] duration-700 sm:block" style={{ width: `${(84 * activo) / (PASOS.length - 1)}%` }} />
      {PASOS.map(([ic, t, d], i) => {
        const on = i <= activo;
        return (
          <div key={t} className="relative text-center">
            <div
              className={`mx-auto mb-3 grid h-[52px] w-[52px] place-items-center rounded-full border-2 bg-background text-xl transition-all duration-300 ${
                on ? "scale-[1.08] border-primary shadow-[0_0_0_6px_#1ba84a22]" : "border-border"
              }`}
            >
              {ic}
            </div>
            <h4 className={`mb-1 font-dash-display text-[15px] font-semibold ${on ? "text-[#7ee3a1]" : "text-foreground"}`}>{t}</h4>
            <p className="m-0 text-[12.5px] leading-[1.45] text-muted">{d}</p>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- IA tecleando ---------- */
const DIALOGO: [("in" | "bot"), string, string][] = [
  ["in", "Buenas noches, ¿tienen el kit de limpieza para carro?", "11:48"],
  ["bot", "¡Buenas noches! Sí, el kit completo está en $89.900 con envío incluido. ¿Para qué ciudad sería?", "IA · 11:48"],
  ["in", "Barranquilla. ¿Llega antes del sábado?", "11:49"],
  ["bot", "Sí, a Barranquilla llega en 2 días hábiles. Si quieres, te dejo el link de pago y mañana Ana confirma tu guía.", "IA · 11:49"],
];

export function AgenteEscribiendo() {
  const ref = useRef<HTMLDivElement>(null);
  const [lineas, setLineas] = useState<{ k: "in" | "bot"; txt: string; meta: string; parcial?: number }[]>([]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let vivo = true;
    let t: ReturnType<typeof setTimeout>;
    let iv: ReturnType<typeof setInterval>;
    function ciclo() {
      setLineas([]);
      let i = 0;
      const rapido = reduceMotion();
      function next() {
        if (!vivo) return;
        if (i >= DIALOGO.length) {
          t = setTimeout(ciclo, 4000);
          return;
        }
        const [k, txt, meta] = DIALOGO[i++];
        if (k === "in" || rapido) {
          setLineas((l) => [...l, { k, txt, meta }]);
          t = setTimeout(next, 1200);
          return;
        }
        let j = 0;
        setLineas((l) => [...l, { k, txt, meta, parcial: 0 }]);
        iv = setInterval(() => {
          j++;
          setLineas((l) => l.map((x, idx) => (idx === l.length - 1 ? { ...x, parcial: j } : x)));
          if (j >= txt.length) {
            clearInterval(iv);
            setLineas((l) => l.map((x, idx) => (idx === l.length - 1 ? { ...x, parcial: undefined } : x)));
            t = setTimeout(next, 1400);
          }
        }, 22);
      }
      next();
    }
    const io = new IntersectionObserver(
      (es) => {
        if (!es[0].isIntersecting) return;
        io.disconnect();
        ciclo();
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => {
      vivo = false;
      io.disconnect();
      clearTimeout(t);
      clearInterval(iv);
    };
  }, []);
  return (
    <div ref={ref} className="flex min-h-[280px] flex-col gap-2 rounded-[16px] border border-[#223028] bg-[#0d1310] p-4 text-[13px] shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
      <div className="flex justify-between text-[11px] uppercase tracking-[.1em] text-[#7c8a82]">
        <span>Chat · 11:48 p.m.</span>
        <em className="not-italic text-primary">● IA activa</em>
      </div>
      {lineas.map((l, i) => (
        <div
          key={i}
          className={`viva-msg max-w-[88%] rounded-[12px] px-[11px] py-2 leading-[1.35] ${
            l.k === "in" ? "self-start rounded-bl-[4px] bg-[#1c2620]" : "self-end border border-dashed border-[#1ba84a88] bg-[#0f1a13] text-[#cfe3d6]"
          }`}
        >
          {l.parcial !== undefined ? (
            <>
              {l.txt.slice(0, l.parcial)}
              <span className="viva-blink ml-0.5 inline-block h-3 w-0.5 bg-[#cfe3d6] align-[-2px]" />
            </>
          ) : (
            <>
              {l.txt}
              <i className="mt-[3px] block text-[10px] not-italic opacity-65">{l.meta}</i>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------- Testimonios ---------- */
const QUOTES = [
  ["“Antes respondía yo desde el celular hasta las 11 de la noche. Ahora el sistema responde primero y mi equipo cierra.”", "Repuestos para el hogar", "Bogotá"],
  ["“Los seguimientos automáticos nos recuperaron clientes que ya dábamos por perdidos.”", "Créditos de consumo", "Medellín"],
  ["“Tres personas en el mismo número, cada una desde su celular, y por fin sé quién atendió qué.”", "Lavandería", "Cali"],
];

export function Testimonios() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduceMotion()) return;
    const iv = setInterval(() => setI((x) => (x + 1) % QUOTES.length), 5000);
    return () => clearInterval(iv);
  }, []);
  return (
    <div className="relative min-h-[220px] overflow-hidden rounded-[16px] border border-border bg-[linear-gradient(180deg,#12261a,#0e1411)] p-6">
      {QUOTES.map(([q, quien, ciudad], k) => (
        <div key={k} className={`absolute inset-6 flex flex-col justify-between transition-all duration-500 ${k === i ? "translate-x-0 opacity-100" : "translate-x-5 opacity-0"}`}>
          <p className="m-0 font-dash-display text-xl leading-[1.35] text-foreground">{q}</p>
          <footer className="mt-3.5 text-[12.5px] text-muted">
            <b className="text-foreground">{quien}</b> · {ciudad}
          </footer>
        </div>
      ))}
      <div className="absolute bottom-4 right-5 flex gap-1.5">
        {QUOTES.map((_, k) => (
          <i key={k} className={`h-1.5 w-1.5 rounded-full ${k === i ? "bg-primary" : "bg-[#2a3630]"}`} />
        ))}
      </div>
    </div>
  );
}
