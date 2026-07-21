"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Megaphone, FileText, Zap, Tag } from "lucide-react";

const tabs = [
  { href: "/dashboard/campaigns", label: "Campañas", icon: Megaphone },
  { href: "/dashboard/templates", label: "Plantillas", icon: FileText },
  { href: "/dashboard/automations", label: "Automatizaciones", icon: Zap },
  { href: "/dashboard/tags", label: "Etiquetas", icon: Tag },
];

export function CampaignsTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-2 flex gap-1 border-b border-border">
      {tabs.map(({ href, label, icon: Icon }) => {
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
