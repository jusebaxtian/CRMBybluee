import { createClient } from "@/lib/supabase/server";
import { FilaTutorial, NuevoTutorialForm, type TutorialAdmin } from "@/components/admin/tutorial-form";
import Link from "next/link";
import { FilaCurso, NuevoCursoForm, type CursoAdmin } from "@/components/admin/curso-form";

export default async function AdminTutorialesPage() {
  const supabase = await createClient();

  const [{ data: tutoriales }, { data: cursos }, { count: pendientes }] = await Promise.all([
    supabase
      .from("tutoriales")
      .select("id, titulo, descripcion, url, modulo, duracion, orden, activo, curso_id")
      .order("orden")
      .order("created_at"),
    supabase
      .from("cursos")
      .select("id, titulo, descripcion, portada_url, precio_cents, currency, datos_transferencia, activo, orden, compra_repetible")
      .order("orden")
      .order("created_at"),
    supabase.from("curso_compras").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  const opcionesCurso = (cursos ?? []).map((c) => ({ id: c.id, titulo: c.titulo }));
  const cursosConCuenta: CursoAdmin[] = (cursos ?? []).map((c) => ({
    ...c,
    lecciones: (tutoriales ?? []).filter((t) => t.curso_id === c.id).length,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-1 text-lg font-semibold text-foreground">Nuevo curso de pago</h2>
        <p className="mb-4 text-xs text-muted">
          El cliente lo ve en <strong>Capacitaciones</strong> con su portada y precio, y paga por la pasarela o por transferencia.
        </p>
        <NuevoCursoForm />
      </div>

      {cursosConCuenta.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <p className="border-b border-border px-5 py-3 text-sm font-semibold text-foreground">Cursos</p>
          {cursosConCuenta.map((c) => (
            <FilaCurso key={c.id} c={c} />
          ))}
        </div>
      )}

      <p className="rounded-xl border border-border bg-surface px-5 py-3 text-sm text-muted">
        Las compras de cursos se revisan y aprueban en{" "}
        <Link href="/admin/payments#compras-de-cursos" className="font-medium text-primary hover:underline">
          Pagos
        </Link>
        {(pendientes ?? 0) > 0 && <span className="ml-2 rounded-full bg-warning/20 px-2 py-0.5 text-[11px] text-warning">{pendientes} por revisar</span>}
      </p>

      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-1 text-lg font-semibold text-foreground">Nueva capacitación</h2>
        <p className="mb-4 text-xs text-muted">
          Sin curso queda como capacitación incluida para todos. Si eliges un curso, será una lección de pago.
        </p>
        <NuevoTutorialForm cursos={opcionesCurso} />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {(tutoriales ?? []).length === 0 && <p className="px-5 py-6 text-sm text-muted">Aún no hay capacitaciones.</p>}
        {((tutoriales ?? []) as TutorialAdmin[]).map((t) => (
          <FilaTutorial key={t.id} t={t} cursos={opcionesCurso} />
        ))}
      </div>
    </div>
  );
}
