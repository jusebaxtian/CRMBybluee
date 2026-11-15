import Link from "next/link";
import { Gift } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { casillasDeReferidos, enlaceDeReferido, TOPE_REFERIDOS, type CasillaDeReferido } from "@/lib/referidos/estado";
import { ReferidosRevision } from "@/components/admin/referidos-revision";

const ESTILO_CASILLA: Record<CasillaDeReferido, string> = {
  usado: "border-success bg-success text-white",
  disponible: "border-success bg-success/15 text-success",
  en_revision: "border-warning bg-warning/15 text-warning",
  libre: "border-border text-muted",
};

const NOMBRE_CASILLA: Record<CasillaDeReferido, string> = {
  usado: "Mes usado",
  disponible: "Mes disponible",
  en_revision: "En revisión",
  libre: "Libre",
};

const ESTADO_PREMIO: Record<string, { texto: string; clase: string }> = {
  en_revision: { texto: "En revisión", clase: "bg-warning/15 text-warning" },
  disponible: { texto: "Mes ganado, sin usar", clase: "bg-success/15 text-success" },
  usado: { texto: "Mes ganado y usado", clase: "bg-success text-white" },
  rechazado: { texto: "Rechazado", clase: "bg-error/15 text-error" },
};

const ESTADO_ESPACIO: Record<string, string> = {
  active: "Activo",
  trialing: "En prueba",
  past_due: "Vencido",
  canceled: "Cancelado",
};

function fecha(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Referidos de un espacio, para el administrador (15 nov 2026): quien lo
 * refirio, a quienes refirio y en que va cada mes gratis, con las mismas tres
 * casillas que ve el cliente en su panel.
 */
export async function ReferidosDelEspacio({ workspaceId }: { workspaceId: string }) {
  const admin = createAdminClient();
  const [{ data: espacio }, { data: referidos }, { data: premios }] = await Promise.all([
    admin.from("workspaces").select("referral_code, referred_by").eq("id", workspaceId).maybeSingle(),
    admin.from("workspaces").select("id, name, status, created_at").eq("referred_by", workspaceId).order("created_at"),
    admin
      .from("referral_rewards")
      .select("id, referred_id, status, motivo_revision, created_at, used_at")
      .eq("referrer_id", workspaceId)
      .order("created_at"),
  ]);

  const referidoPorId = (espacio?.referred_by as string | null) ?? null;
  const { data: quienRefirio } = referidoPorId
    ? await admin.from("workspaces").select("id, name").eq("id", referidoPorId).maybeSingle()
    : { data: null };

  // Fin del plan de cada referido, para ver que activaron su tiempo.
  const ids = (referidos ?? []).map((r) => r.id as string);
  const { data: subs } = ids.length
    ? await admin.from("subscriptions").select("workspace_id, current_period_end").in("workspace_id", ids).eq("status", "active")
    : { data: [] as { workspace_id: string; current_period_end: string }[] };
  const finDe = new Map<string, string>();
  for (const s of subs ?? []) {
    const f = s.current_period_end as string;
    if (f && (!finDe.has(s.workspace_id) || f > finDe.get(s.workspace_id)!)) finDe.set(s.workspace_id, f);
  }
  const premioDe = new Map((premios ?? []).map((p) => [p.referred_id as string, p]));

  const cuenta = (estado: string) => (premios ?? []).filter((p) => p.status === estado).length;
  const usados = cuenta("usado");
  const disponibles = cuenta("disponible");
  const enRevision = cuenta("en_revision");
  const casillas = casillasDeReferidos({ usados, disponibles, enRevision });
  const codigo = (espacio?.referral_code as string | null) ?? null;

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground">
        <Gift size={15} className="text-success" />
        Referidos
      </p>

      {quienRefirio && (
        <p className="mb-4 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-foreground">
          Este cliente es referido por{" "}
          <Link href={`/admin/workspaces/${quienRefirio.id}`} className="font-semibold text-primary hover:underline">
            {quienRefirio.name}
          </Link>
        </p>
      )}

      <p className="mb-2 text-xs text-muted">
        Así lo ve el cliente: {usados + disponibles} de {TOPE_REFERIDOS} meses ganados
        {codigo ? (
          <>
            {" "}· enlace <span className="font-mono text-foreground">{enlaceDeReferido(codigo)}</span>
          </>
        ) : null}
      </p>
      <div className="mb-5 grid grid-cols-3 gap-2 sm:max-w-md">
        {casillas.map((c, i) => (
          <div key={i} className={`rounded-lg border px-2 py-2 text-center text-xs font-semibold ${ESTILO_CASILLA[c]}`}>
            {NOMBRE_CASILLA[c]}
          </div>
        ))}
      </div>

      <p className="mb-2 text-xs font-medium text-muted">Sus referidos ({ids.length})</p>
      {ids.length === 0 ? (
        <p className="text-sm text-muted">Todavía no ha referido a nadie.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="py-2 pr-3 font-medium">Espacio</th>
                <th className="py-2 pr-3 font-medium">Se registró</th>
                <th className="py-2 pr-3 font-medium">Estado</th>
                <th className="py-2 pr-3 font-medium">Plan hasta</th>
                <th className="py-2 font-medium">Mes gratis para este cliente</th>
              </tr>
            </thead>
            <tbody>
              {(referidos ?? []).map((r) => {
                const premio = premioDe.get(r.id as string);
                const estado = premio ? ESTADO_PREMIO[premio.status as string] : null;
                return (
                  <tr key={r.id as string} className="border-b border-border last:border-b-0">
                    <td className="py-2 pr-3">
                      <Link href={`/admin/workspaces/${r.id}`} className="font-medium text-primary hover:underline">
                        {r.name as string}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 text-muted">{fecha(r.created_at as string)}</td>
                    <td className="py-2 pr-3 text-foreground">{ESTADO_ESPACIO[r.status as string] ?? (r.status as string)}</td>
                    <td className="py-2 pr-3 text-foreground">{fecha(finDe.get(r.id as string))}</td>
                    <td className="py-2">
                      {estado ? (
                        <span className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${estado.clase}`}>{estado.texto}</span>
                          {premio?.status === "usado" && <span className="text-xs text-muted">el {fecha(premio.used_at as string)}</span>}
                          {premio?.status === "en_revision" && (
                            <>
                              {premio.motivo_revision && <span className="text-xs text-muted">{premio.motivo_revision as string}</span>}
                              <ReferidosRevision id={premio.id as string} />
                            </>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs text-muted">Aún no paga: sin mes ganado</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
