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

/** Ficha del servicio: si el espacio ya pagó muestra las lecciones; si no, cómo pagar. */
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
    .select("id, titulo, descripcion, portada_url, precio_cents, currency, activo")
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

  // Con acceso se piden las lecciones completas; sin acceso la base ya no las
  // entrega (migracion 0123), asi que el temario --titulos y duracion, nunca
  // los enlaces-- viene de una funcion aparte. Antes esta consulta devolvia
  // los enlaces de YouTube a cualquiera que preguntara por la API.
  const { data: lecciones } = acceso
    ? await supabase
        .from("tutoriales")
        .select("id, titulo, descripcion, url, modulo, duracion")
        .eq("curso_id", id)
        .eq("activo", true)
        .order("orden")
        .order("created_at")
    : { data: null };

  const { data: temario } = acceso
    ? { data: null }
    : await supabase.rpc("curso_temario", { p_curso_id: id });

  const listado = (acceso ? lecciones : temario) as
    | { id: string; titulo: string; duracion: string | null }[]
    | null;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/dashboard/tutoriales" className="flex w-fit items-center gap-2 text-sm text-muted hover:text-foreground">
        <ArrowLeft size={15} /> Volver a Capacitaciones
      </Link>

      {/* Ficha de producto. Arriba, el cartel completo y la tarjeta de compra lado a lado
          (miden casi lo mismo, asi que no queda hueco). Debajo, la descripcion a todo el
          ancho y en dos columnas de texto en pantalla ancha.

          Antes la descripcion iba dentro de la tarjeta de la derecha y dejaba un hueco
          vacio bajo el cartel; ponerla bajo el cartel solo movia el hueco al otro lado.

          Orden en el codigo --cartel, compra, descripcion--: en telefono se lee asi y la
          compra no queda enterrada bajo un texto largo. */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="relative aspect-video w-full overflow-hidden rounded-[15px] border border-border bg-[#0e1411]">
          {curso.portada_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={curso.portada_url} alt={curso.titulo} className="absolute inset-0 h-full w-full object-contain" />
          ) : (
            <span className="absolute inset-0 bg-gradient-to-br from-[#16351f] to-[#0e1411]" />
          )}
        </div>
        <div className="flex flex-col gap-3 rounded-[15px] border border-border bg-surface p-5">
          <h1 className="font-dash-display text-[22px] font-bold leading-tight tracking-[-.4px] text-foreground">{curso.titulo}</h1>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[26px] font-bold leading-none tracking-[-.5px] text-foreground">
              {curso.precio_cents > 0 ? precioCop(curso.precio_cents, curso.currency) : "Gratis"}
            </span>
            <span className="text-xs text-muted">
              {(listado ?? []).length} {(listado ?? []).length === 1 ? "lección" : "lecciones"}
            </span>
            {acceso && <span className="rounded-full bg-success/15 px-3 py-1 text-xs font-bold text-success">Comprado ✓</span>}
          </div>
          {/* UN solo bloque de compra, dentro de la misma tarjeta del producto: antes habia
              un "Comprar ahora" aqui y otra tarjeta de pago mas abajo, dos botones de compra
              compitiendo. */}
          {!acceso && (
            <ComprarCurso cursoId={curso.id} precio={precioCop(curso.precio_cents, curso.currency)} hayPendiente={pendiente} />
          )}
        </div>
        {curso.descripcion && (
          <div className="rounded-[15px] border border-border bg-surface p-5 lg:col-span-2">
            <p className="mb-2 text-sm font-semibold text-foreground">Descripción</p>
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted lg:columns-2 lg:gap-10">{curso.descripcion}</p>
          </div>
        )}
      </div>

      {acceso ? (
        <BibliotecaTutoriales tutoriales={(lecciones ?? []) as Tutorial[]} abrirInicial={null} />
      ) : (
        <div className="rounded-[13px] border border-border bg-surface p-5">
          <p className="mb-3 text-sm font-semibold text-foreground">Contenido del servicio</p>
          <ul className="flex flex-col gap-2">
            {(listado ?? []).map((l, i) => (
              <li key={l.id} className="flex items-center gap-3 border-b border-border pb-2 text-sm last:border-b-0">
                <span className="text-xs text-muted">{String(i + 1).padStart(2, "0")}</span>
                <PlayCircle size={15} className="shrink-0 text-muted" />
                <span className="min-w-0 flex-1 truncate text-foreground">{l.titulo}</span>
                {l.duracion && <span className="text-xs text-muted">{l.duracion}</span>}
                <Lock size={13} className="shrink-0 text-muted" />
              </li>
            ))}
            {(listado ?? []).length === 0 && <li className="text-sm text-muted">Pronto se publicarán las lecciones.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
