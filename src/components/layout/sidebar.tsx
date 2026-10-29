"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Megaphone,
  Reply,
  BarChart3,
  Settings,
  ShieldCheck,
  CreditCard,
  Lock,
  LifeBuoy,
  CalendarDays,
  PlaySquare,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

// `built: false` items don't exist yet regardless of plan.
// `moduleKey` items are gated by the workspace's plan (plan_modules);
// omitting moduleKey means always available once built.
const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, built: true, moduleKey: null },
  { href: "/dashboard/inbox", label: "Conversaciones", icon: MessageSquare, built: true, moduleKey: "inbox" },
  { href: "/dashboard/contacts", label: "Contactos", icon: Users, built: true, moduleKey: "contacts" },
  { href: "/dashboard/campaigns", label: "Campañas", icon: Megaphone, built: true, moduleKey: "campaigns" },
  { href: "/dashboard/billing", label: "Facturación", icon: CreditCard, built: true, moduleKey: null },
  { href: "/dashboard/quick-replies", label: "Respuestas rápidas", icon: Reply, built: true, moduleKey: "quick_replies" },
  { href: "/dashboard/agenda", label: "Agenda", icon: CalendarDays, built: true, moduleKey: null },
  { href: "/dashboard/reports", label: "Reportes", icon: BarChart3, built: true, moduleKey: "reports" },
  { href: "/dashboard/settings", label: "Configuración", icon: Settings, built: true, moduleKey: "settings" },
  { href: "/dashboard/tutoriales", label: "Capacitaciones", icon: PlaySquare, built: true, moduleKey: null },
];

// Lo que ve un vendedor (0160): ademas de Conversaciones, Dashboard, Contactos y Agenda.
const RUTAS_VENDEDOR = ["/dashboard", "/dashboard/inbox", "/dashboard/contacts", "/dashboard/agenda"];

export function Sidebar({
  workspaceName,
  demo = null,
  workspaceRole,
  esVendedor = false,
  encogido = false,
  onAlternar,
  billingLocked = false,
  isPlatformAdmin = false,
  enabledModules = [],
  unreadMessagesCount = 0,
  supportWhatsappNumber,
  supportWhatsappMessage,
  onNavigate,
}: {
  workspaceName: string;
  /** Cuenta DEMO: dias que le quedan. null si no es demo. */
  demo?: { diasRestantes: number | null } | null;
  workspaceRole?: string | null;
  esVendedor?: boolean;
  /** Solo iconos con el nombre pequeno debajo. Aplica en pantallas grandes: en el celular el menu es un cajon y va completo. */
  encogido?: boolean;
  onAlternar?: () => void;
  billingLocked?: boolean;
  isPlatformAdmin?: boolean;
  enabledModules?: string[];
  unreadMessagesCount?: number;
  supportWhatsappNumber?: string | null;
  supportWhatsappMessage?: string | null;
  onNavigate?: () => void;
}) {
  const supportHref = supportWhatsappNumber
    ? `https://wa.me/${supportWhatsappNumber}?text=${encodeURIComponent(supportWhatsappMessage ?? "")}`
    : null;
  const pathname = usePathname();
  const tutorialesVisitados = useTutorialesVisitados(pathname);
  const e = encogido;
  // Lo que se esconde al encoger (solo en lg).
  const soloAbierto = e ? "lg:hidden" : "";
  // Fila normal → en encogido, icono arriba y nombre pequeno debajo.
  const filaEncogida = e ? "lg:flex-col lg:gap-[5px] lg:px-1 lg:py-[9px] lg:text-center" : "";
  const nombreEncogido = e ? "lg:w-full lg:text-[10px] lg:leading-[1.15] lg:tracking-[-.1px]" : "";
  const iconoEncogido = e ? "lg:h-[19px] lg:w-[19px]" : "";

  return (
    <aside
      className={`flex h-screen w-[232px] shrink-0 flex-col gap-[22px] overflow-y-auto overflow-x-hidden border-r border-border bg-surface px-[14px] py-5 font-dash-ui transition-[width,padding] duration-300 ease-[cubic-bezier(.4,0,.2,1)] ${
        e ? "lg:w-[84px] lg:px-2" : ""
      }`}
    >
      {/* Marca */}
      <div className={`flex items-center gap-[10px] px-1 ${e ? "lg:flex-col lg:gap-3 lg:px-0" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt=""
          aria-hidden
          className="h-9 w-9 shrink-0 rounded-[10px] shadow-[0_4px_14px_rgba(27,168,74,0.28)] ring-1 ring-white/10 transition-transform duration-300 hover:scale-105"
        />
        <div className={`min-w-0 leading-none ${soloAbierto}`}>
          <span className="block whitespace-nowrap font-dash-display text-[16px] font-bold tracking-[-.2px] text-foreground">ByBluee</span>
          <span className="mt-[3px] block whitespace-nowrap text-[9.5px] font-semibold uppercase tracking-[1.2px] text-success/80">
            CRM WhatsApp
          </span>
        </div>
        {onAlternar && (
          <button
            type="button"
            onClick={onAlternar}
            aria-label={e ? "Ampliar menú" : "Encoger menú"}
            title={e ? "Ampliar menú" : "Encoger menú"}
            className={`hidden h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-muted transition-all duration-200 hover:bg-[rgba(255,255,255,0.06)] hover:text-foreground active:scale-90 lg:flex ${
              e ? "" : "ml-auto"
            }`}
          >
            {e ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        )}
      </div>

      {/* Navegacion */}
      <nav aria-label="Secciones" className={`flex flex-col gap-[2px] ${e ? "lg:gap-1" : ""}`}>
        {navItems
          .filter((item) =>
            billingLocked
              ? item.href === "/dashboard/billing"
              : workspaceRole !== "agent" || item.href === "/dashboard/inbox" || (esVendedor && RUTAS_VENDEDOR.includes(item.href))
          )
          .map(({ href, label, icon: Icon, built, moduleKey }) => {
            const locked = built && moduleKey !== null && !enabledModules.includes(moduleKey);
            const ready = built && !locked;
            const active = ready && (href === "/dashboard" ? pathname === href : pathname.startsWith(href));
            // Tutoriales va resaltado en verde hasta que lo abren por primera vez.
            const tutoriales = href === "/dashboard/tutoriales";
            const conteo = href === "/dashboard/inbox" && ready ? unreadMessagesCount : 0;
            const content = (
              <span
                className={`relative flex items-center gap-[11px] rounded-[9px] px-3 py-[10px] text-[13.5px] transition-all duration-200 ${filaEncogida} ${
                  active
                    ? "bg-dash-green-13 font-semibold text-success"
                    : tutoriales && !tutorialesVisitados
                      ? "mt-1 border border-primary/50 bg-primary/10 font-semibold text-success hover:bg-primary/15"
                      : ready
                        ? "font-medium text-muted hover:bg-[rgba(255,255,255,0.04)] hover:text-foreground"
                        : "cursor-default font-medium text-muted/40"
                }`}
              >
                <span aria-hidden className={`relative flex w-[18px] justify-center ${ready ? "" : "opacity-60"} ${e ? "lg:w-auto" : ""}`}>
                  <Icon size={15} className={iconoEncogido} />
                  {e && conteo > 0 && (
                    <span className="absolute -right-[12px] -top-[7px] hidden min-w-[17px] rounded-[20px] bg-primary px-[4px] text-center text-[9.5px] font-bold leading-[15px] text-white lg:block">
                      {conteo > 99 ? "99+" : conteo}
                    </span>
                  )}
                </span>
                <span className={`truncate ${nombreEncogido}`}>{label}</span>
                {conteo > 0 && (
                  <span
                    className={`ml-auto rounded-[20px] bg-primary px-[7px] py-px text-[11px] font-bold text-white ${soloAbierto}`}
                    aria-label={`${conteo} sin leer`}
                  >
                    {conteo > 99 ? "99+" : conteo}
                  </span>
                )}
                {tutoriales && !tutorialesVisitados && (
                  <span className={`ml-auto rounded-[20px] bg-primary px-[7px] py-px text-[10px] font-bold text-white ${soloAbierto}`}>NUEVO</span>
                )}
                {!built && (
                  <span className={`ml-auto rounded-[20px] border border-border px-[7px] py-px text-[10px] font-semibold text-muted ${soloAbierto}`}>
                    Pronto
                  </span>
                )}
                {locked && (
                  <Lock
                    size={12}
                    className={`ml-auto text-muted ${e ? "lg:absolute lg:right-1 lg:top-1 lg:ml-0" : ""}`}
                    aria-label="No incluido en tu plan"
                  />
                )}
              </span>
            );

            return ready ? (
              <Link
                key={href}
                href={href}
                className="block"
                onClick={onNavigate}
                title={e ? label : undefined}
                aria-current={active ? "page" : undefined}
              >
                {content}
              </Link>
            ) : (
              <div key={href} title={locked ? "No incluido en tu plan actual" : undefined}>
                {content}
              </div>
            );
          })}

        {isPlatformAdmin && (
          <Link
            href="/admin"
            onClick={onNavigate}
            title={e ? "Panel admin" : undefined}
            className={`mt-1 flex items-center gap-[11px] rounded-[9px] px-3 py-[10px] text-[13.5px] font-medium text-primary transition-all duration-200 hover:bg-[rgba(255,255,255,0.04)] ${filaEncogida}`}
          >
            <span aria-hidden className={`flex w-[18px] justify-center ${e ? "lg:w-auto" : ""}`}>
              <ShieldCheck size={15} className={iconoEncogido} />
            </span>
            <span className={`truncate ${nombreEncogido}`}>Panel admin</span>
          </Link>
        )}
      </nav>

      {/* Tarjeta de usuario */}
      <div className="mt-auto flex flex-col gap-2">
        <div
          title={e ? workspaceName : undefined}
          className={`flex items-center gap-[10px] rounded-[11px] border border-border bg-background p-[11px] ${
            e ? "lg:justify-center lg:border-transparent lg:bg-transparent lg:p-1" : ""
          }`}
        >
          <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-white">
            {workspaceName.charAt(0).toUpperCase()}
          </div>
          <div className={`min-w-0 ${soloAbierto}`}>
            <p className="truncate text-[12.5px] font-semibold text-foreground">{workspaceName}</p>
            <p className="text-[11px] text-muted">{esVendedor ? "Vendedor" : workspaceRole === "agent" ? "Agente" : "Administrador"}</p>
          </div>
        </div>

        {demo && (
          <Link
            href="/dashboard/billing"
            onClick={onNavigate}
            title={e ? "Cuenta DEMO" : undefined}
            className={`flex items-start gap-2 rounded-[11px] border border-pink-500/30 bg-pink-500/10 p-[10px] transition-colors duration-150 hover:bg-pink-500/15 ${
              e ? "lg:justify-center" : ""
            }`}
          >
            <Sparkles size={14} className="mt-[1px] shrink-0 text-pink-500" aria-hidden />
            <span className={`min-w-0 ${soloAbierto}`}>
              <span className="block text-[12px] font-bold text-pink-500">
                Cuenta DEMO
                {demo.diasRestantes !== null && (
                  <span className="font-medium text-muted">
                    {" "}
                    · {demo.diasRestantes === 0 ? "termina hoy" : `${demo.diasRestantes} ${demo.diasRestantes === 1 ? "día" : "días"}`}
                  </span>
                )}
              </span>
              <span className="block text-[11px] leading-snug text-muted">
                Actívate un plan para tener los beneficios ilimitados
              </span>
            </span>
          </Link>
        )}

        {supportHref && (
          <a
            href={supportHref}
            target="_blank"
            rel="noopener noreferrer"
            title={e ? "Ayuda / Soporte" : undefined}
            className={`flex items-center justify-center gap-2 rounded-[9px] border border-border px-3 py-2 text-[12.5px] font-medium text-muted transition-colors duration-150 hover:bg-[rgba(255,255,255,0.04)] hover:text-foreground ${
              e ? "lg:flex-col lg:gap-1 lg:px-1 lg:text-[10px]" : ""
            }`}
          >
            <LifeBuoy size={15} aria-hidden />
            <span className={soloAbierto}>Ayuda / Soporte</span>
            {e && <span className="hidden lg:inline">Ayuda</span>}
          </a>
        )}
      </div>
    </aside>
  );
}

const CLAVE_TUTORIALES = "bybluee:tutoriales-visitados";

/** true una vez que el navegador abrio /dashboard/tutoriales alguna vez (se recuerda en localStorage). */
function useTutorialesVisitados(pathname: string): boolean {
  const [visitados, setVisitados] = useState(true);
  useEffect(() => {
    try {
      if (pathname.startsWith("/dashboard/tutoriales")) {
        localStorage.setItem(CLAVE_TUTORIALES, "1");
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setVisitados(true);
      } else {

        setVisitados(localStorage.getItem(CLAVE_TUTORIALES) === "1");
      }
    } catch {}
  }, [pathname]);
  return visitados;
}
