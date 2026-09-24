import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock, PlayCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { BibliotecaTutoriales, type Tutorial } from "@/components/tutoriales/biblioteca-tutoriales";
import { ComprarCurso } from "@/components/tutoriales/comprar-curso";
import { confirmarCompraBold } from "@/app/actions/cursos";

function precioCop(cents: number, currency: string) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: currency || "COP", maximumFractionDigits: 0 }).format(
    cents / 100
  );
}

/** Ficha del curso: si el espacio ya pagó muestra las lecciones; si no, cómo pagar. */
export default async function CursoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);

  // Vuelta de la pasarela: ?bold-order-id=...&bold-tx-status=approved
  const orderId = typeof sp["bold-order-id"] === "string" ? sp["bold-order-id"] : null;
  if (orderId) {
    await confirmarCompraBold(orderId, typeof sp["bold-tx-status"] === "string" ? sp["bold-tx-status"] : null);
  }

  const { data: curso } = await supabase
    .from("cursos")
    .select("id, titulo, descripcion, portada_url, precio_cents, currency, datos_transferencia, activo")
    .eq("id", id)
    .maybeSingle();
  if (!curso) notFound();

  const { data: compras } = await supabase
    .from("curso_compras")
    .select("id, status")
    .eq("curso_id", id)
    .eq("workspace_id", workspaceId ?? "");
  const acceso = (compras ?? []).some((c) => c.status === "approved");
  const pendiente = (compras ?? []).some((c) => c.status === "pending");

  const { data: lecciones } = await supabase
    .from("tutoriales")
    .select("id, titulo, descripcion, url, modulo, duracion")
    .eq("curso_id", id)
    .eq("activo", true)
    .order("orden")
    .order("created_at");

  return (
    <div className="flex flex-col gap-6">
      <Link href="/dashboard/tutoriales" className="flex w-fit items-center gap-2 text-sm text-muted hover:text-foreground">
        <ArrowLeft size={15} /> Volver a Tutoriales
      </Link>

      <div className="overflow-hidden rounded-[15px] border border-border bg-surface">
        {curso.portada_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={curso.portada_url} alt="" className="h-52 w-full object-cover sm:h-72" />
        )}
        <div className="flex flex-col gap-2 p-6">
          <h1 className="font-dash-display text-[24px] font-bold tracking-[-.4px] text-foreground">{curso.titulo}</h1>
          {curso.descripcion && <p className="whitespace-pre-line text-sm leading-relaxed text-muted">{curso.descripcion}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-primary/15 px-3 py-1 text-sm font-bold text-success">
              {curso.precio_cents > 0 ? precioCop(curso.precio_cents, curso.currency) : "Gratis"}
            </span>
            <span className="text-xs text-muted">
              {(lecciones ?? []).length} {(lecciones ?? []).length === 1 ? "lección" : "lecciones"}
            </span>
            {acceso && <span className="rounded-full bg-success/15 px-3 py-1 text-xs font-bold text-success">Comprado ✓</span>}
          </div>
        </div>
      </div>

      {acceso ? (
        <BibliotecaTutoriales tutoriales={(lecciones ?? []) as Tutorial[]} abrirInicial={null} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
          <div className="rounded-[13px] border border-border bg-surface p-5">
            <p className="mb-3 text-sm font-semibold text-foreground">Contenido del curso</p>
            <ul className="flex flex-col gap-2">
              {(lecciones ?? []).map((l, i) => (
                <li key={l.id} className="flex items-center gap-3 border-b border-border pb-2 text-sm last:border-b-0">
                  <span className="text-xs text-muted">{String(i + 1).padStart(2, "0")}</span>
                  <PlayCircle size={15} className="shrink-0 text-muted" />
                  <span className="min-w-0 flex-1 truncate text-foreground">{l.titulo}</span>
                  {l.duracion && <span className="text-xs text-muted">{l.duracion}</span>}
                  <Lock size={13} className="shrink-0 text-muted" />
                </li>
              ))}
              {(lecciones ?? []).length === 0 && <li className="text-sm text-muted">Pronto se publicarán las lecciones.</li>}
            </ul>
          </div>
          <ComprarCurso
            cursoId={curso.id}
            precio={precioCop(curso.precio_cents, curso.currency)}
            datosTransferencia={curso.datos_transferencia}
            hayPendiente={pendiente}
          />
        </div>
      )}
    </div>
  );
}
