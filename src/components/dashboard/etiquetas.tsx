import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { cargarContactosDeEtiqueta } from "@/lib/dashboard/datos";
import { TableroEtiquetas, type ColumnaEtiqueta } from "@/components/dashboard/tablero-etiquetas";

export const CONTACTOS_POR_COLUMNA = 5;

/**
 * Tablero de etiquetas del dashboard: una columna por etiqueta con sus
 * contactos y el ultimo mensaje. Sustituye a la tabla de etiquetas; conserva
 * su filtro por fecha de creacion del contacto (tagsFrom / tagsTo).
 */
export async function Etiquetas({ creadoDesde, creadoHasta }: { creadoDesde: string | null; creadoHasta: string | null }) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return null;

  const desdeIso = creadoDesde ? new Date(`${creadoDesde}T00:00:00`).toISOString() : null;
  const hastaIso = creadoHasta ? new Date(`${creadoHasta}T23:59:59.999`).toISOString() : null;

  let totalQuery = supabase.from("contacts").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId);
  if (desdeIso) totalQuery = totalQuery.gte("created_at", desdeIso);
  if (hastaIso) totalQuery = totalQuery.lte("created_at", hastaIso);

  const [{ data: tags }, { data: conteos }, { count: totalContactos }] = await Promise.all([
    supabase.from("tags").select("id, name, color").eq("workspace_id", workspaceId).order("position"),
    supabase.rpc("tag_contact_counts", { p_workspace_id: workspaceId, p_created_from: desdeIso, p_created_to: hastaIso }),
    totalQuery,
  ]);

  const conteoPor = new Map(
    ((conteos ?? []) as { tag_id: string; contact_count: number }[]).map((r) => [r.tag_id, Number(r.contact_count)])
  );

  const columnas: ColumnaEtiqueta[] = await Promise.all(
    (tags ?? []).map(async (t) => {
      const total = conteoPor.get(t.id) ?? 0;
      const contactos =
        total > 0
          ? await cargarContactosDeEtiqueta(supabase, workspaceId, t.id, {
              limite: CONTACTOS_POR_COLUMNA,
              desde: 0,
              creadoDesde: desdeIso,
              creadoHasta: hastaIso,
            })
          : [];
      return { id: t.id, nombre: t.name, color: t.color, total, contactos };
    })
  );

  return (
    <TableroEtiquetas
      columnas={columnas}
      totalContactos={totalContactos ?? 0}
      creadoDesde={creadoDesde}
      creadoHasta={creadoHasta}
      creadoDesdeIso={desdeIso}
      creadoHastaIso={hastaIso}
      porColumna={CONTACTOS_POR_COLUMNA}
    />
  );
}
