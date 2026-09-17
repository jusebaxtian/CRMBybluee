import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { Agenda } from "@/components/agenda/agenda";
import { listarRecordatoriosEntre } from "@/app/actions/recordatorios";

/**
 * Agenda del espacio: todos los recordatorios de todos los contactos en un
 * calendario mensual (migracion 0110). El mes inicial se carga aqui; los
 * demas los pide el calendario al navegar.
 */
export default async function AgendaPage() {
  const supabase = await createClient();
  await getWorkspaceId(supabase);

  const hoy = new Date();
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 20);
  const fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 12);
  const inicial = await listarRecordatoriosEntre(inicio.toISOString(), fin.toISOString());

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-dash-display text-[22px] font-bold tracking-[-.4px] text-foreground">Agenda</h1>
        <p className="mt-1 text-sm text-muted">
          Recordatorios de tus contactos. Al cumplirse te avisan en la campana y desaparecen de aquí.
        </p>
      </div>
      <Agenda inicial={inicial} mesInicial={`${hoy.getFullYear()}-${hoy.getMonth() + 1}`} />
    </div>
  );
}
