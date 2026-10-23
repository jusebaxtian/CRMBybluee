import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { Agenda } from "@/components/agenda/agenda";
import { listarRecordatoriosEntre } from "@/app/actions/recordatorios";
import { listarEventosEntre } from "@/app/actions/agenda-eventos";
import { getEnabledModuleKeys } from "@/lib/entitlements";
import { contextoDeCita } from "@/lib/agenda/contexto-de-cita";

/**
 * Agenda del espacio: todos los recordatorios de todos los contactos en un
 * calendario mensual (migracion 0110). El mes inicial se carga aqui; los
 * demas los pide el calendario al navegar.
 */
export default async function AgendaPage() {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);

  const hoy = new Date();
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 20);
  const fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 12);
  const inicial = await listarRecordatoriosEntre(inicio.toISOString(), fin.toISOString());
  const eventosIniciales = await listarEventosEntre(inicio.toISOString(), fin.toISOString());

  // Programar citas exige el modulo en el plan Y la conexion personal con Google.
  const moduloIncluido = (await getEnabledModuleKeys(supabase, workspaceId)).includes("google_calendar");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: conexion } = user
    ? await supabase.from("integraciones_conexiones").select("estado").eq("user_id", user.id).eq("proveedor", "google_calendar").maybeSingle()
    : { data: null };
  const { correo: correoDeCuenta, modoSoporte } = user ? await contextoDeCita(supabase, workspaceId, user) : { correo: null, modoSoporte: false };
  const googleListo = moduloIncluido && !modoSoporte && conexion?.estado === "conectado";
  const requiereReconexion = moduloIncluido && !modoSoporte && conexion?.estado === "requiere_reconexion";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-dash-display text-[22px] font-bold tracking-[-.4px] text-foreground">Agenda</h1>
        <p className="mt-1 text-sm text-muted">
          Citas y recordatorios de tus contactos. Los recordatorios te avisan en la campana al cumplirse y quedan aquí 60 días; las citas se sincronizan con tu Google Calendar.
        </p>
      </div>
      <Agenda
        inicial={inicial}
        eventosIniciales={eventosIniciales}
        mesInicial={`${hoy.getFullYear()}-${hoy.getMonth() + 1}`}
        googleListo={googleListo}
        moduloIncluido={moduloIncluido}
        requiereReconexion={requiereReconexion}
        correoDeCuenta={correoDeCuenta}
        modoSoporte={modoSoporte}
      />
    </div>
  );
}
