import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeWaId } from "@/lib/phone";
import { mensajeDeErrorDeContactos } from "@/lib/billing/demo";

export const COLUMNAS_CONTACTO =
  "id, wa_id, name, notes, variable2, variable3, variable4, marketing_opt_out_at, created_at, etiquetas:contact_tags(tags(name))";

type FilaContacto = {
  id: string;
  wa_id: string;
  name: string | null;
  notes: string | null;
  variable2: string | null;
  variable3: string | null;
  variable4: string | null;
  marketing_opt_out_at: string | null;
  created_at: string;
  etiquetas?: { tags: { name: string } | { name: string }[] | null }[] | null;
};

/** El contacto tal como lo ve quien usa la API. */
export function contactoPublico(f: FilaContacto) {
  const etiquetas = (f.etiquetas ?? [])
    .flatMap((e) => (Array.isArray(e.tags) ? e.tags : e.tags ? [e.tags] : []))
    .map((t) => t.name);
  return {
    id: f.id,
    telefono: f.wa_id,
    nombre: f.name,
    notas: f.notes,
    variable2: f.variable2,
    variable3: f.variable3,
    variable4: f.variable4,
    etiquetas,
    sin_marketing: !!f.marketing_opt_out_at,
    creado_el: f.created_at,
  };
}

const MAX_TEXTO = 500;

/** Valida los campos editables. Devuelve las columnas a escribir o el motivo del rechazo. */
export function validarDatosContacto(cuerpo: Record<string, unknown>): { columnas: Record<string, unknown> } | { motivo: string } {
  const columnas: Record<string, unknown> = {};
  const mapa: [string, string][] = [
    ["nombre", "name"],
    ["notas", "notes"],
    ["variable2", "variable2"],
    ["variable3", "variable3"],
    ["variable4", "variable4"],
  ];
  for (const [campo, columna] of mapa) {
    if (!(campo in cuerpo)) continue;
    const v = cuerpo[campo];
    if (v === null) {
      columnas[columna] = null;
    } else if (typeof v === "string" || typeof v === "number") {
      const texto = String(v).trim();
      if (texto.length > MAX_TEXTO) return { motivo: `«${campo}» no puede pasar de ${MAX_TEXTO} caracteres.` };
      columnas[columna] = texto === "" ? null : texto;
    } else {
      return { motivo: `«${campo}» debe ser un texto.` };
    }
  }
  if ("name" in columnas) columnas.name_source = columnas.name ? "manual" : "whatsapp";
  return { columnas };
}

export function telefonoValido(valor: unknown): string | null {
  if (typeof valor !== "string" && typeof valor !== "number") return null;
  return normalizeWaId(String(valor));
}

/** Busca el contacto por telefono en el espacio; si no existe, lo crea. */
export async function contactoPorTelefono(
  admin: SupabaseClient,
  workspaceId: string,
  telefono: string
): Promise<{ contacto: { id: string; wa_id: string } | null; creado: boolean; error?: string }> {
  const { data: existente } = await admin.from("contacts").select("id, wa_id").eq("workspace_id", workspaceId).eq("wa_id", telefono).maybeSingle();
  if (existente) return { contacto: existente, creado: false };
  const { data: nuevo, error } = await admin.from("contacts").insert({ workspace_id: workspaceId, wa_id: telefono }).select("id, wa_id").single();
  if (error || !nuevo) {
    // Si otro proceso lo creo en este instante, se reutiliza.
    const { data: ya } = await admin.from("contacts").select("id, wa_id").eq("workspace_id", workspaceId).eq("wa_id", telefono).maybeSingle();
    if (ya) return { contacto: ya, creado: false };
    return { contacto: null, creado: false, error: mensajeDeErrorDeContactos(error?.message ?? "No se pudo crear el contacto.") };
  }
  return { contacto: nuevo, creado: true };
}
