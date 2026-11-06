import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/admin";
import { conexionDeIa } from "@/lib/ai/vendedor";
import { vozDisponible } from "@/lib/ai/voz";
import { AgenteVendedorPanel } from "@/components/admin/agente-vendedor";

export const dynamic = "force-dynamic";

export default async function AgenteJuanesPage() {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return null;

  const admin = createAdminClient();
  const { data: vendedor } = await admin.from("agente_vendedor").select("workspace_id, nombre, activo, instrucciones, voz_activa, voz_id, numeros_prueba").limit(1).maybeSingle();
  if (!vendedor) return <p className="p-6 text-sm text-muted">El agente todavía no está creado.</p>;

  const [conexion, { data: automatizaciones }] = await Promise.all([
    conexionDeIa(admin, vendedor.workspace_id as string),
    admin
      .from("automations")
      .select("name")
      .eq("workspace_id", vendedor.workspace_id)
      .eq("is_active", true)
      .in("trigger_type", ["keyword", "tag_added"])
      .order("name"),
  ]);

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <h1 className="font-dash-display text-[22px] font-bold tracking-[-.4px] text-foreground">Agente {vendedor.nombre as string}</h1>
      <p className="mt-1 text-sm text-muted">Tu vendedor de IA: lleva al cliente de frío a tibio, a caliente y al pago en todos tus chats. Conoce la etapa del cliente y su cuenta, lee imágenes y avisa cuando llega un soporte de pago.</p>
      <AgenteVendedorPanel
        nombre={vendedor.nombre as string}
        activo={vendedor.activo as boolean}
        instrucciones={vendedor.instrucciones as string}
        conexion={conexion ? `${conexion.provider === "openai" ? "OpenAI" : "Anthropic"} · ${conexion.model}` : null}
        automatizacionesAPausar={(automatizaciones ?? []).map((a) => a.name as string)}
        vozActiva={vendedor.voz_activa as boolean}
        vozId={vendedor.voz_id as string}
        hayLlaveDeVoz={vozDisponible()}
        numerosPrueba={(vendedor.numeros_prueba as string[] | null) ?? []}
      />
    </div>
  );
}
