import { createClient } from "@/lib/supabase/server";
import { BibliotecaTutoriales, type Tutorial } from "@/components/tutoriales/biblioteca-tutoriales";

/** Biblioteca de tutoriales en video (migracion 0116). Los administra el admin de la plataforma. */
export default async function TutorialesPage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const { ver } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("tutoriales")
    .select("id, titulo, descripcion, url, modulo, duracion")
    .eq("activo", true)
    .order("orden")
    .order("created_at");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-dash-display text-[22px] font-bold tracking-[-.4px] text-foreground">Tutoriales</h1>
        <p className="mt-1 text-sm text-muted">Aprende a usar ByBluee paso a paso con videos cortos de cada módulo.</p>
      </div>
      <BibliotecaTutoriales tutoriales={(data ?? []) as Tutorial[]} abrirInicial={ver ?? null} />
    </div>
  );
}
