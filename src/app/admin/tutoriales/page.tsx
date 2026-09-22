import { createClient } from "@/lib/supabase/server";
import { FilaTutorial, NuevoTutorialForm, type TutorialAdmin } from "@/components/admin/tutorial-form";

export default async function AdminTutorialesPage() {
  const supabase = await createClient();
  const { data: tutoriales } = await supabase
    .from("tutoriales")
    .select("id, titulo, descripcion, url, modulo, duracion, orden, activo")
    .order("orden")
    .order("created_at");

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-1 text-lg font-semibold text-foreground">Nuevo tutorial</h2>
        <p className="mb-4 text-xs text-muted">
          Los clientes los ven en el menú <strong>Tutoriales</strong> de su panel. No se suben videos: solo el enlace.
        </p>
        <NuevoTutorialForm />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {(tutoriales ?? []).length === 0 && <p className="px-5 py-6 text-sm text-muted">Aún no hay tutoriales.</p>}
        {((tutoriales ?? []) as TutorialAdmin[]).map((t) => (
          <FilaTutorial key={t.id} t={t} />
        ))}
      </div>
    </div>
  );
}
