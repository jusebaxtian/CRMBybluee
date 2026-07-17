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
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, ready: true },
  { href: "/dashboard/inbox", label: "Conversaciones", icon: MessageSquare, ready: false },
  { href: "/dashboard/contacts", label: "Contactos", icon: Users, ready: false },
  { href: "/dashboard/campaigns", label: "Campañas", icon: Megaphone, ready: false },
  { href: "/dashboard/templates", label: "Plantillas", icon: FileText, ready: false },
  { href: "/dashboard/automations", label: "Automatizaciones", icon: Zap, ready: false },
  { href: "/dashboard/tags", label: "Etiquetas", icon: Tag, ready: false },
  { href: "/dashboard/quick-replies", label: "Respuestas rápidas", icon: Reply, ready: false },
  { href: "/dashboard/reports", label: "Reportes", icon: BarChart3, ready: false },
  { href: "/dashboard/integrations", label: "Integraciones", icon: Plug, ready: false },
  { href: "/dashboard/settings", label: "Configuración", icon: Settings, ready: false },
];

export function Sidebar({ workspaceName }: { workspaceName: string }) {
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
        {navItems.map(({ href, label, icon: Icon, ready }) => {
          const active = ready && pathname === href;
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
              {!ready && (
                <span className="rounded-full bg-surface-hover px-2 py-0.5 text-[10px] text-muted">
                  Pronto
                </span>
              )}
            </span>
          );

          return ready ? (
            <Link key={href} href={href} className="block">
              {content}
            </Link>
          ) : (
            <div key={href}>{content}</div>
          );
        })}
      </nav>

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
