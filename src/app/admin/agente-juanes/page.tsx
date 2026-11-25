import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/admin";
import { conexionDeIa } from "@/lib/ai/vendedor";
import { vozDisponible } from "@/lib/ai/voz";
import { AgenteVendedorPanel } from "@/components/admin/agente-vendedor";
import { AlcanceJuanes } from "@/components/admin/alcance-juanes";
import { AiAgentMediaLibrary } from "@/components/ai-agent/ai-agent-media-library";
import { personasConChats } from "@/lib/agents";

export const dynamic = "force-dynamic";

export default async function AgenteJuanesPage() {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return null;

  const admin = createAdminClient();
  const { data: vendedor } = await admin.from("agente_vendedor").select("workspace_id, nombre, activo, instrucciones, voz_activa, voz_id, numeros_prueba, lineas_modo, lineas_ids, asesores_modo, asesores_ids").limit(1).maybeSingle();
  if (!vendedor) return <p className="p-6 text-sm text-muted">El agente todavía no está creado.</p>;

  const [conexion, { data: lineas }, personas, { data: biblioteca }] = await Promise.all([
    conexionDeIa(admin, vendedor.workspace_id as string),
    admin
      .from("whatsapp_accounts")
      .select("id, label, display_phone_number")
      .eq("workspace_id", vendedor.workspace_id)
      .order("connected_at"),
    personasConChats(admin as unknown as Awaited<ReturnType<typeof createClient>>, vendedor.workspace_id as string),
    admin
      .from("ai_agent_media")
      .select("id, key, label, trigger_description, media_type, media_url")
      .eq("workspace_id", vendedor.workspace_id)
      .eq("del_vendedor", true)
      .order("created_at"),
  ]);

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <h1 className="font-dash-display text-[22px] font-bold tracking-[-.4px] text-foreground">Agente {vendedor.nombre as string}</h1>
      <p className="mt-1 text-sm text-muted">Tu vendedor de IA: lleva al cliente de frío a tibio, a caliente y al pago en los chats que elijas. Conoce la etapa del cliente y su cuenta, lee imágenes y avisa cuando llega un soporte de pago.</p>
      <AgenteVendedorPanel
        nombre={vendedor.nombre as string}
        activo={vendedor.activo as boolean}
        instrucciones={vendedor.instrucciones as string}
        conexion={conexion ? `${conexion.provider === "openai" ? "OpenAI" : "Anthropic"} · ${conexion.model}` : null}
        vozActiva={vendedor.voz_activa as boolean}
        vozId={vendedor.voz_id as string}
        hayLlaveDeVoz={vozDisponible()}
        numerosPrueba={(vendedor.numeros_prueba as string[] | null) ?? []}
        biblioteca={
          <AiAgentMediaLibrary
            items={(biblioteca ?? []) as Parameters<typeof AiAgentMediaLibrary>[0]["items"]}
            paraVendedor
          />
        }
        alcance={
          <AlcanceJuanes
            nombre={vendedor.nombre as string}
            lineas={(lineas ?? []).map((l) => ({
              id: l.id as string,
              nombre: l.label ? `${l.label} · ${l.display_phone_number}` : (l.display_phone_number as string),
            }))}
            asesores={personas.map((p) => ({ id: p.id, nombre: p.nombre }))}
            inicial={{
              lineasModo: (vendedor.lineas_modo as string) ?? "todas",
              lineasIds: (vendedor.lineas_ids as string[] | null) ?? [],
              asesoresModo: (vendedor.asesores_modo as string) ?? "todos",
              asesoresIds: (vendedor.asesores_ids as string[] | null) ?? [],
            }}
          />
        }
      />
    </div>
  );
}
