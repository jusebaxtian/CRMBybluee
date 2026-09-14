import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { getEnabledModuleKeys } from "@/lib/entitlements";
import { CampaignsTabs } from "@/components/layout/campaigns-tabs";

/**
 * Marco de la seccion Campañas / Plantillas / Automatizaciones / Seguimientos
 * / Etiquetas: las pestañas se pintan desde el layout de cada ruta, asi
 * siguen visibles al crear o editar (antes solo estaban en los listados y
 * quien entraba a una automatizacion no tenia como volver ni cambiar de
 * pestaña).
 */
export async function CampaignsSection({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  const enabledModules = await getEnabledModuleKeys(supabase, workspaceId);

  return (
    <div className="flex flex-col gap-6">
      <CampaignsTabs enabledModules={enabledModules} />
      {children}
    </div>
  );
}
