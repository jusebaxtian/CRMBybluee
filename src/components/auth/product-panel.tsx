import { Inbox, Users, Megaphone, Zap, BarChart3, Check, CheckCheck } from "lucide-react";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";

/**
 * Panel derecho de las pantallas de autenticacion: una vista del propio
 * CRM, compuesta con los bloques reales del dashboard (conexion, KPIs,
 * contactos por dia, pendientes) y dos tarjetas flotantes (un chat de la
 * bandeja y una campaña). Es una ilustracion estatica —quien la ve aun no
 * ha entrado— pero todo lo que muestra existe en el producto.
 */

const MODULOS = [
  { icono: Inbox, nombre: "Bandeja", activo: true, insignia: "3" },
  { icono: Users, nombre: "Contactos" },
  { icono: Megaphone, nombre: "Campañas" },
  { icono: Zap, nombre: "Automatizaciones" },
  { icono: BarChart3, nombre: "Reportes" },
];

const KPIS = [
  { nombre: "Sin responder", valor: "3", delta: "-40 %", bueno: true },
  { nombre: "Tiempo de respuesta", valor: "4 min", delta: "-2 min", bueno: true },
  { nombre: "Contactos nuevos", valor: "128", delta: "+18 %", bueno: true },
];

const BARRAS = [34, 52, 41, 68, 59, 83, 74];
const DIAS = ["L", "M", "X", "J", "V", "S", "D"];

const PENDIENTES = [
  { nombre: "Laura Gómez", texto: "¿Tienen envío a Medellín?", hace: "2 min" },
  { nombre: "Carlos Ruiz", texto: "Quiero el plan PRO", hace: "9 min" },
  { nombre: "Ana Torres", texto: "Gracias, ya pagué 🙌", hace: "15 min" },
];

export function ProductPanel() {
  const maximo = Math.max(...BARRAS);

  return (
    <div
      aria-hidden
      className="relative flex h-full min-h-[640px] flex-col items-center justify-center overflow-hidden rounded-[28px] px-10 py-12"
      style={{
        background:
          "radial-gradient(120% 90% at 100% 0%, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 55%), linear-gradient(160deg, var(--primary) 0%, var(--primary-hover) 100%)",
      }}
    >
      {/* Decoracion geometrica sutil */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full border-[28px] border-white/[0.06]" />
      <div className="pointer-events-none absolute -bottom-32 -right-20 h-96 w-96 rounded-full border-[32px] border-white/[0.06]" />
      <div className="pointer-events-none absolute right-[18%] top-[14%] h-3 w-3 rounded-full bg-white/30" />
      <div className="pointer-events-none absolute left-[12%] bottom-[24%] h-2 w-2 rounded-full bg-white/30" />

      {/* Distintivo de WhatsApp (equivalente al sello de la referencia) */}
      <div className="absolute right-10 top-10 flex h-16 w-16 items-center justify-center rounded-[20px] bg-white text-primary shadow-[0_18px_40px_rgba(0,0,0,0.25)]">
        <WhatsAppIcon size={34} />
      </div>

      {/* Dashboard */}
      <div className="relative w-full max-w-[560px]">
        <div className="overflow-hidden rounded-[16px] border border-white/10 bg-background shadow-[0_40px_80px_rgba(0,0,0,0.35)]">
          {/* Barra superior */}
          <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="h-5 w-5 rounded-md" />
            <span className="text-[11px] font-semibold text-foreground">ByBluee</span>
            <div className="ml-4 h-5 flex-1 rounded-md bg-background" />
            <div className="h-5 w-5 rounded-full bg-primary/20" />
          </div>

          <div className="flex">
            {/* Menu lateral */}
            <div className="w-[118px] shrink-0 border-r border-border bg-surface p-2.5">
              {MODULOS.map((m) => (
                <div
                  key={m.nombre}
                  className={`mb-1 flex items-center gap-1.5 rounded-[7px] px-2 py-1.5 text-[10px] font-medium ${
                    m.activo ? "bg-dash-green-13 text-success" : "text-muted"
                  }`}
                >
                  <m.icono size={11} />
                  <span className="truncate">{m.nombre}</span>
                  {m.insignia && (
                    <span className="ml-auto rounded-full bg-primary px-1.5 text-[8px] font-bold text-white">{m.insignia}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Contenido */}
            <div className="flex-1 space-y-2.5 p-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-foreground">Buenos días, Sebastián</p>
                <span className="flex items-center gap-1 rounded-full bg-dash-green-13 px-2 py-0.5 text-[9px] font-semibold text-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  API conectada
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {KPIS.map((k) => (
                  <div key={k.nombre} className="rounded-[9px] border border-border bg-surface p-2">
                    <p className="text-[8.5px] text-muted">{k.nombre}</p>
                    <p className="mt-0.5 font-dash-display text-[15px] font-bold text-foreground">{k.valor}</p>
                    <p className="text-[8.5px] font-semibold text-success">{k.delta}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-[1.4fr_1fr] gap-2">
                <div className="rounded-[9px] border border-border bg-surface p-2.5">
                  <p className="text-[9px] font-semibold text-foreground">Contactos creados por día</p>
                  <div className="mt-2 flex h-[54px] items-end gap-1.5">
                    {BARRAS.map((v, i) => (
                      <div key={i} className="flex flex-1 flex-col items-center gap-1">
                        <div
                          className={`w-full rounded-[3px] ${i === BARRAS.length - 1 ? "bg-primary" : "bg-dash-green-28"}`}
                          style={{ height: `${(v / maximo) * 44}px` }}
                        />
                        <span className="text-[7.5px] text-muted">{DIAS[i]}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-[9px] border border-border bg-surface p-2.5">
                  <p className="text-[9px] font-semibold text-foreground">Sin responder</p>
                  <ul className="mt-1.5 space-y-1.5">
                    {PENDIENTES.map((p) => (
                      <li key={p.nombre} className="flex items-center gap-1.5">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[7.5px] font-bold text-primary">
                          {p.nombre.charAt(0)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[8.5px] font-medium text-foreground">{p.nombre}</p>
                          <p className="truncate text-[7.5px] text-muted">{p.texto}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tarjeta flotante: chat de la bandeja */}
        <div className="absolute -left-10 top-[58%] w-[200px] rounded-[14px] border border-border bg-surface p-3 shadow-[0_24px_50px_rgba(0,0,0,0.4)]">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">L</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold text-foreground">Laura Gómez</p>
              <p className="text-[9px] text-success">Ventana abierta · 23 h</p>
            </div>
            <WhatsAppIcon size={14} className="text-success" />
          </div>
          <div className="mt-2.5 space-y-1.5">
            <div className="w-fit max-w-[85%] rounded-[9px] rounded-tl-[3px] bg-surface-hover px-2 py-1.5 text-[9.5px] text-foreground">
              ¿Tienen envío a Medellín?
            </div>
            <div className="ml-auto w-fit max-w-[85%] rounded-[9px] rounded-tr-[3px] bg-primary px-2 py-1.5 text-[9.5px] text-white">
              ¡Sí! Llega en 24 h 🚚
              <CheckCheck size={9} className="ml-1 inline text-white/80" />
            </div>
          </div>
        </div>

        {/* Tarjeta flotante: campaña */}
        <div className="absolute -right-6 -top-8 w-[184px] rounded-[14px] border border-border bg-surface p-3 shadow-[0_24px_50px_rgba(0,0,0,0.4)]">
          <div className="flex items-center gap-1.5 text-[9px] font-semibold text-muted">
            <Megaphone size={11} className="text-primary" />
            Campaña · Lanzamiento
          </div>
          <p className="mt-1.5 font-dash-display text-[18px] font-bold text-foreground">1.240</p>
          <p className="text-[9px] text-muted">mensajes entregados</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
            <div className="h-full w-[86%] rounded-full bg-primary" />
          </div>
          <p className="mt-1.5 flex items-center gap-1 text-[9px] font-semibold text-success">
            <Check size={10} /> 86 % leídos
          </p>
        </div>
      </div>

      {/* Mensaje comercial */}
      <div className="relative mt-16 max-w-[420px] text-center">
        <p className="font-dash-display text-[26px] font-bold leading-tight tracking-[-.4px] text-white">
          Vende más por WhatsApp, con la API oficial de Meta.
        </p>
        <p className="mt-2 text-[14px] text-white/80">
          Bandeja compartida, campañas, automatizaciones y seguimientos en un solo lugar.
        </p>
      </div>
    </div>
  );
}
