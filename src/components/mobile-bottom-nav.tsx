"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MessageSquare, Users, MoreHorizontal } from "lucide-react";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, moduleKey: null },
  { href: "/dashboard/inbox", label: "Chats", icon: MessageSquare, moduleKey: "inbox" },
  { href: "/dashboard/contacts", label: "Contactos", icon: Users, moduleKey: "contacts" },
  { href: "/dashboard/settings", label: "Más", icon: MoreHorizontal, moduleKey: "settings" },
];

export function MobileBottomNav({
  workspaceRole,
  billingLocked = false,
  enabledModules = [],
  unreadMessagesCount = 0,
}: {
  workspaceRole?: string | null;
  billingLocked?: boolean;
  enabledModules?: string[];
  unreadMessagesCount?: number;
}) {
  const pathname = usePathname();

  // A conversation is open full-screen — hide the bar so it doesn't eat
  // space from the chat, mirroring the sidebar's mobile behavior.
  const conversationOpen =
    pathname.startsWith("/dashboard/inbox/") && pathname !== "/dashboard/inbox";
  if (conversationOpen) return null;

  const visibleItems = items.filter((item) =>
    billingLocked
      ? item.href === "/dashboard/billing"
      : workspaceRole !== "agent" || item.href === "/dashboard/inbox"
  );

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex h-14 items-stretch border-t border-border bg-surface lg:hidden">
      {visibleItems.map(({ href, label, icon: Icon, moduleKey }) => {
        const locked = moduleKey !== null && !enabledModules.includes(moduleKey);
        const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);

        const content = (
          <span
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] ${
              locked
                ? "text-muted/50"
                : active
                  ? "font-semibold text-primary"
                  : "text-muted"
            }`}
          >
            <span className="relative">
              <Icon size={20} />
              {href === "/dashboard/inbox" && !locked && unreadMessagesCount > 0 && (
                <span className="absolute -right-2 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-success px-0.5 text-[8px] font-medium text-white">
                  {unreadMessagesCount > 99 ? "99+" : unreadMessagesCount}
                </span>
              )}
            </span>
            {label}
          </span>
        );

        return locked ? (
          <div key={href} className="flex flex-1">
            {content}
          </div>
        ) : (
          <Link key={href} href={href} className="flex flex-1">
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
