import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cuentas de WhatsApp Business (WABA) de un espacio (migracion 0106).
 *
 * En Meta las plantillas pertenecen a la WABA, no a la linea ni al negocio.
 * Casi todos los espacios tienen una sola WABA (y ahi las plantillas son
 * compartidas entre sus lineas), pero uno puede conectar lineas de WABAs
 * distintas y entonces cada una tiene sus propias plantillas.
 */

export type Waba = {
  wabaId: string;
  accessToken: string;
  /** Lineas conectadas de esta WABA, para mostrar "316 5311098, 324 5701712". */
  lineas: string;
  accountIds: string[];
};

export async function wabasDelEspacio(supabase: SupabaseClient, workspaceId: string | null): Promise<Waba[]> {
  if (!workspaceId) return [];
  const { data } = await supabase
    .from("whatsapp_accounts")
    .select("id, waba_id, access_token, label, display_phone_number, connected_at")
    .eq("workspace_id", workspaceId)
    .neq("status", "frozen")
    .order("connected_at");
  const porWaba = new Map<string, Waba>();
  for (const a of data ?? []) {
    const etiqueta = a.label ? `${a.label} · ${a.display_phone_number}` : a.display_phone_number;
    const w = porWaba.get(a.waba_id);
    if (w) {
      w.lineas += `, ${etiqueta}`;
      w.accountIds.push(a.id);
    } else {
      porWaba.set(a.waba_id, { wabaId: a.waba_id, accessToken: a.access_token, lineas: etiqueta, accountIds: [a.id] });
    }
  }
  return [...porWaba.values()];
}

/** Version sin token, para pasar a componentes de cliente. */
export type WabaOption = { wabaId: string; lineas: string };

export function opcionesDeWaba(wabas: Waba[]): WabaOption[] {
  return wabas.map((w) => ({ wabaId: w.wabaId, lineas: w.lineas }));
}
