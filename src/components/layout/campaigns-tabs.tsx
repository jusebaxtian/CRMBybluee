"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Megaphone, FileText, Zap, Tag, History, Lock } from "lucide-react";

const tabs = [
  { href: "/dashboard/campaigns", label: "Campañas", icon: Megaphone, moduleKey: "campaigns" },
  { href: "/dashboard/templates", label: "Plantillas", icon: FileText, moduleKey: "templates" },
  { href: "/dashboard/automations", label: "Automatizaciones", icon: Zap, moduleKey: "automations" },
  { href: "/dashboard/followups", label: "Seguimientos", icon: History, moduleKey: "followups" },
  { href: "/dashboard/tags", label: "Etiquetas", icon: Tag, moduleKey: "tags" },
];

export function CampaignsTabs({ enabledModules }: { enabledModules?: string[] }) {
  const pathname = usePathname();

  return (
    <div className="mb-2 flex gap-1 border-b border-border">
      {tabs.map(({ href, label, icon: Icon, moduleKey }) => {
        const locked = enabledModules !== undefined && !enabledModules.includes(moduleKey);
        if (locked) {
          return (
            <span
              key={href}
              title="No incluido en tu plan actual"
              className="flex cursor-default items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted/40"
            >
              <Icon size={14} />
              {label}
              <Lock size={11} />
            </span>
          );
        }
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            <Icon size={14} />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
