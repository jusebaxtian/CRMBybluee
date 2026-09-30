import Link from "next/link";
import { FlaskConical, Workflow } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { requireModule } from "@/lib/entitlements";
import { NuevoFlujoBoton } from "@/components/flujos/nuevo-flujo-boton";

export default async function FlujosPage() {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  await requireModule(supabase, workspaceId, "flujos");

  const { data: flujos } = await supabase
    .from("flujos")
    .select("id, nombre, descripcion, activo, updated_at")
    .eq("workspace_id", workspaceId ?? "")
    .order("updated_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-2.5 rounded-[11px] border border-warning/40 bg-warning/10 px-3.5 py-2.5">
        <FlaskConical size={15} className="mt-0.5 shrink-0 text-warning" />
        <p className="text-[12.5px] leading-relaxed text-foreground">
          <span className="font-semibold text-warning">Estamos en BETA.</span> Flujos es nuevo y lo estamos
          puliendo: puede cambiar de aquí a poco y algo puede fallar. Pruébalo con confianza, pero antes de
          montar encima toda tu operación, déjalo corriendo unos días y cuéntanos qué tal te fue.
        </p>
      </div>

      <div className="flex items-start justify-between gap-4">
        <p className="max-w-2xl text-sm text-muted">
          Arma la conversación en un lienzo: un mensaje con botones, qué pasa con cada respuesta, cuánto esperar
          si no contesta y cuándo entregarle el chat al agente de IA.
        </p>
        <NuevoFlujoBoton />
      </div>

      {!flujos || flujos.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[13px] border border-border bg-surface p-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-hover text-muted">
            <Workflow size={22} />
          </div>
          <h2 className="font-dash-ui text-[15px] font-semibold text-foreground">Todavía no tienes flujos</h2>
          <p className="mt-1 max-w-md text-sm text-muted">
            Crea el primero y dibújalo bloque por bloque. Mientras no lo actives, no le llega a ningún contacto.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[13px] border border-border bg-surface">
          {flujos.map((f) => (
            <Link
              key={f.id}
              href={`/dashboard/flujos/${f.id}`}
              className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 last:border-b-0 hover:bg-surface-hover"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{f.nombre}</p>
                <p className="mt-0.5 text-[11px] text-muted">
                  Editado el{" "}
                  {new Date(f.updated_at).toLocaleString("es-CO", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${
                  f.activo ? "border-success text-success" : "border-border text-muted"
                }`}
              >
                {f.activo ? "Activo" : "Borrador"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
