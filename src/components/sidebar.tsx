"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Megaphone,
  FileText,
  Zap,
  Tag,
  Reply,
  BarChart3,
  Plug,
  Settings,
  ShieldCheck,
  CreditCard,
  Lock,
} from "lucide-react";

// `built: false` items don't exist yet regardless of plan.
// `moduleKey` items are gated by the workspace's plan (plan_modules);
// omitting moduleKey means always available once built.
const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, built: true, moduleKey: null },
  { href: "/dashboard/inbox", label: "Conversaciones", icon: MessageSquare, built: true, moduleKey: "inbox" },
  { href: "/dashboard/contacts", label: "Contactos", icon: Users, built: true, moduleKey: "contacts" },
  { href: "/dashboard/campaigns", label: "Campañas", icon: Megaphone, built: true, moduleKey: "campaigns" },
  { href: "/dashboard/templates", label: "Plantillas", icon: FileText, built: true, moduleKey: "campaigns" },
  { href: "/dashboard/automations", label: "Automatizaciones", icon: Zap, built: true, moduleKey: "automations" },
  { href: "/dashboard/tags", label: "Etiquetas", icon: Tag, built: true, moduleKey: null },
  { href: "/dashboard/billing", label: "Facturación", icon: CreditCard, built: true, moduleKey: null },
  { href: "/dashboard/quick-replies", label: "Respuestas rápidas", icon: Reply, built: false, moduleKey: null },
  { href: "/dashboard/reports", label: "Reportes", icon: BarChart3, built: false, moduleKey: null },
  { href: "/dashboard/integrations", label: "Integraciones", icon: Plug, built: false, moduleKey: null },
  { href: "/dashboard/settings", label: "Configuración", icon: Settings, built: false, moduleKey: null },
];

export function Sidebar({
  workspaceName,
  isPlatformAdmin = false,
  enabledModules = [],
}: {
  workspaceName: string;
  isPlatformAdmin?: boolean;
  enabledModules?: string[];
}) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2 px-6 py-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-bold text-white">
          B
        </div>
        <span className="text-lg font-semibold text-foreground">ByBluee</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3">
        {navItems.map(({ href, label, icon: Icon, built, moduleKey }) => {
          const locked = built && moduleKey !== null && !enabledModules.includes(moduleKey);
          const ready = built && !locked;
          const active =
            ready &&
            (href === "/dashboard" ? pathname === href : pathname.startsWith(href));
          const content = (
            <span
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-primary text-white"
                  : ready
                    ? "text-muted hover:bg-surface-hover hover:text-foreground"
                    : "text-muted/50 cursor-default"
              }`}
            >
              <span className="flex items-center gap-3">
                <Icon size={18} />
                {label}
              </span>
              {!built && (
                <span className="rounded-full bg-surface-hover px-2 py-0.5 text-[10px] text-muted">
                  Pronto
                </span>
              )}
              {locked && <Lock size={12} className="text-muted" />}
            </span>
          );

          return ready ? (
            <Link key={href} href={href} className="block">
              {content}
            </Link>
          ) : (
            <div key={href} title={locked ? "No incluido en tu plan actual" : undefined}>
              {content}
            </div>
          );
        })}
      </nav>

      {isPlatformAdmin && (
        <div className="px-3 pb-2">
          <Link
            href="/admin"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-primary hover:bg-surface-hover"
          >
            <ShieldCheck size={18} />
            Panel admin
          </Link>
        </div>
      )}

      <div className="border-t border-border p-4">
        <div className="flex items-center gap-2 rounded-lg bg-surface-hover px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-white">
            {workspaceName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{workspaceName}</p>
            <p className="text-xs text-muted">Administrador</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
