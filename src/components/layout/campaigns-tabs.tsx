"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Megaphone, FileText, Zap, Tag, History, Lock, Workflow } from "lucide-react";

const tabs = [
  { href: "/dashboard/campaigns", label: "Campañas", icon: Megaphone, moduleKey: "campaigns", beta: false },
  { href: "/dashboard/templates", label: "Plantillas", icon: FileText, moduleKey: "templates", beta: false },
  { href: "/dashboard/automations", label: "Automatizaciones", icon: Zap, moduleKey: "automations", beta: false },
  // Flujos sigue en beta: el lienzo y el motor estan, pero el modulo es
  // reciente y conviene que el cliente lo sepa antes de montar su operacion
  // encima.
  { href: "/dashboard/flujos", label: "Flujos", icon: Workflow, moduleKey: "flujos", beta: true },
  { href: "/dashboard/followups", label: "Seguimientos", icon: History, moduleKey: "followups", beta: false },
  { href: "/dashboard/tags", label: "Etiquetas", icon: Tag, moduleKey: "tags", beta: false },
];

/** Distintivo de beta, del mismo tamaño que el de "Pronto" del menu. */
function Beta() {
  return (
    <span className="rounded-[20px] border border-warning/50 bg-warning/10 px-[6px] py-px text-[9.5px] font-bold uppercase tracking-wide text-warning">
      Beta
    </span>
  );
}

export function CampaignsTabs({ enabledModules }: { enabledModules?: string[] }) {
  const pathname = usePathname();

  return (
    <div className="mb-2 flex gap-1 border-b border-border">
      {tabs.map(({ href, label, icon: Icon, moduleKey, beta }) => {
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
            {beta && <Beta />}
          </Link>
        );
      })}
    </div>
  );
}
