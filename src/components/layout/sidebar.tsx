"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Megaphone,
  Reply,
  BarChart3,
  Plug,
  Settings,
  ShieldCheck,
  CreditCard,
  Lock,
  LifeBuoy,
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
  { href: "/dashboard/reports", label: "Reportes", icon: BarChart3, built: true, moduleKey: "reports" },
  { href: "/dashboard/integrations", label: "Integraciones", icon: Plug, built: false, moduleKey: null },
  { href: "/dashboard/settings", label: "Configuración", icon: Settings, built: true, moduleKey: "settings" },
];

export function Sidebar({
  workspaceName,
  workspaceRole,
  billingLocked = false,
  isPlatformAdmin = false,
  enabledModules = [],
  unreadMessagesCount = 0,
  supportWhatsappNumber,
  supportWhatsappMessage,
  onNavigate,
}: {
  workspaceName: string;
  workspaceRole?: string | null;
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

  return (
    <aside className="flex h-screen w-[232px] shrink-0 flex-col gap-[26px] overflow-y-auto border-r border-border bg-surface px-[14px] py-5 font-dash-ui">
      {/* Marca */}
      <div className="flex items-center gap-[10px] px-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" aria-hidden className="h-8 w-8 rounded-[9px]" />
        <span className="font-dash-display text-[16px] font-bold tracking-[-.2px] text-foreground">ByBluee</span>
      </div>

      {/* Navegacion */}
      <nav aria-label="Secciones" className="flex flex-col gap-[2px]">
        {navItems
          .filter((item) =>
            billingLocked
              ? item.href === "/dashboard/billing"
              : workspaceRole !== "agent" || item.href === "/dashboard/inbox"
          )
          .map(({ href, label, icon: Icon, built, moduleKey }) => {
            const locked = built && moduleKey !== null && !enabledModules.includes(moduleKey);
            const ready = built && !locked;
            const active = ready && (href === "/dashboard" ? pathname === href : pathname.startsWith(href));
            const content = (
              <span
                className={`flex items-center gap-[11px] rounded-[9px] px-3 py-[10px] text-[13.5px] transition-colors duration-150 ${
                  active
                    ? "bg-dash-green-13 font-semibold text-success"
                    : ready
                      ? "font-medium text-muted hover:bg-[rgba(255,255,255,0.04)] hover:text-foreground"
                      : "cursor-default font-medium text-muted/40"
                }`}
              >
                <span aria-hidden className={`flex w-[18px] justify-center ${ready ? "" : "opacity-60"}`}>
                  <Icon size={15} />
                </span>
                <span className="truncate">{label}</span>
                {href === "/dashboard/inbox" && ready && unreadMessagesCount > 0 && (
                  <span
                    className="ml-auto rounded-[20px] bg-primary px-[7px] py-px text-[11px] font-bold text-white"
                    aria-label={`${unreadMessagesCount} sin responder`}
                  >
                    {unreadMessagesCount > 99 ? "99+" : unreadMessagesCount}
                  </span>
                )}
                {!built && (
                  <span className="ml-auto rounded-[20px] border border-border px-[7px] py-px text-[10px] font-semibold text-muted">
                    Pronto
                  </span>
                )}
                {locked && <Lock size={12} className="ml-auto text-muted" aria-label="No incluido en tu plan" />}
              </span>
            );

            return ready ? (
              <Link
                key={href}
                href={href === "/dashboard/inbox" && unreadMessagesCount > 0 ? "/dashboard/inbox?filtro=sin-responder" : href}
                className="block"
                onClick={onNavigate}
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
            className="mt-1 flex items-center gap-[11px] rounded-[9px] px-3 py-[10px] text-[13.5px] font-medium text-primary transition-colors duration-150 hover:bg-[rgba(255,255,255,0.04)]"
          >
            <span aria-hidden className="flex w-[18px] justify-center"><ShieldCheck size={15} /></span>
            Panel admin
          </Link>
        )}
      </nav>

      {/* Tarjeta de usuario */}
      <div className="mt-auto flex flex-col gap-2">
        <div className="flex items-center gap-[10px] rounded-[11px] border border-border bg-background p-[11px]">
          <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-white">
            {workspaceName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-semibold text-foreground">{workspaceName}</p>
            <p className="text-[11px] text-muted">{workspaceRole === "agent" ? "Agente" : "Administrador"}</p>
          </div>
        </div>

        {supportHref && (
          <a
            href={supportHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-[9px] border border-border px-3 py-2 text-[12.5px] font-medium text-muted transition-colors duration-150 hover:bg-[rgba(255,255,255,0.04)] hover:text-foreground"
          >
            <LifeBuoy size={15} aria-hidden />
            Ayuda / Soporte
          </a>
        )}
      </div>
    </aside>
  );
}
