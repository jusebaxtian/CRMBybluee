import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { requireModule } from "@/lib/entitlements";
import { listWorkspaceAgents } from "@/lib/agents";
import { noSePuedeUsar } from "@/lib/whatsapp/limite-plantilla";
import { LienzoFlujo, type ConexionInicial, type NodoInicial } from "@/components/flujos/lienzo";
import { ActivarFlujo } from "@/components/flujos/activar-flujo";
import { LineaDelFlujo } from "@/components/flujos/linea-del-flujo";
import type { DatosBloque, TipoBloque } from "@/lib/flujos/bloques";

export default async function FlujoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  await requireModule(supabase, workspaceId, "flujos");

  const { data: flujo } = await supabase
    .from("flujos")
    .select("id, nombre, activo, whatsapp_account_id")
    .eq("id", id)
    .eq("workspace_id", workspaceId ?? "")
    .maybeSingle();
  if (!flujo) notFound();

  // Los catalogos que necesitan los bloques para elegir: plantillas, agentes,
  // etiquetas, respuestas rapidas, automatizaciones y los otros flujos.
  const [
    { data: nodos },
    { data: conexiones },
    { data: disparadores },
    { data: etiquetas },
    { data: plantillas },
    { data: respuestasRapidas },
    { data: automatizaciones },
    { data: otrosFlujos },
  ] = await Promise.all([
    supabase.from("flujo_nodos").select("id, tipo, datos, pos_x, pos_y").eq("flujo_id", id),
    supabase.from("flujo_conexiones").select("origen_id, destino_id, salida").eq("flujo_id", id),
    supabase.from("flujo_disparadores").select("tipo, valor, tag_id").eq("flujo_id", id),
    supabase.from("tags").select("id, name").eq("workspace_id", workspaceId ?? "").order("name"),
    supabase
      .from("templates")
      .select("id, meta_template_name, language, body_text")
      .eq("workspace_id", workspaceId ?? "")
      .eq("status", "APPROVED")
      .eq("created_via", "crm")
      .order("meta_template_name"),
    supabase
      .from("quick_replies")
      .select("id, name")
      .eq("workspace_id", workspaceId ?? "")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("automations")
      .select("id, name")
      .eq("workspace_id", workspaceId ?? "")
      .order("name"),
    supabase
      .from("flujos")
      .select("id, nombre")
      .eq("workspace_id", workspaceId ?? "")
      .neq("id", id)
      .order("nombre"),
  ]);

  const agentes = await listWorkspaceAgents(supabase, workspaceId);

  // Las lineas conectadas del espacio: por cual sale el flujo y cual lo
  // dispara.
  const { data: lineas } = await supabase
    .from("whatsapp_accounts")
    .select("id, label, display_phone_number")
    .eq("workspace_id", workspaceId ?? "")
    .neq("status", "frozen")
    .order("connected_at");

  // Los disparadores viven en su propia tabla pero se editan dentro del
  // bloque de inicio: aqui se devuelven a ese bloque para pintarlos.
  const disparadoresDelInicio = (disparadores ?? []).map((d) => ({
    tipo: d.tipo as "keyword" | "any_message" | "first_message_of_day" | "tag" | "manual",
    valor: (d.valor as string | null) ?? undefined,
    tagId: (d.tag_id as string | null) ?? undefined,
  }));

  const nodosIniciales: NodoInicial[] = (nodos ?? []).map((n) => ({
    id: n.id as string,
    tipo: n.tipo as TipoBloque,
    datos:
      n.tipo === "inicio"
        ? { ...((n.datos ?? {}) as DatosBloque), disparadores: disparadoresDelInicio }
        : ((n.datos ?? {}) as DatosBloque),
    x: Number(n.pos_x),
    y: Number(n.pos_y),
  }));

  const conexionesIniciales: ConexionInicial[] = (conexiones ?? []).map((c) => ({
    origen: c.origen_id as string,
    destino: c.destino_id as string,
    salida: (c.salida as string | null) ?? null,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/dashboard/flujos"
            className="flex w-fit items-center gap-2 text-sm text-muted hover:text-foreground"
          >
            <ArrowLeft size={15} /> Volver a Flujos
          </Link>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="truncate font-dash-display text-[22px] font-bold tracking-[-.4px] text-foreground">
              {flujo.nombre}
            </h1>
            <span className="shrink-0 rounded-[20px] border border-warning/50 bg-warning/10 px-[7px] py-px text-[9.5px] font-bold uppercase tracking-wide text-warning">
              Beta
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <LineaDelFlujo
            flujoId={id}
            lineaActual={(flujo.whatsapp_account_id as string | null) ?? null}
            lineas={lineas ?? []}
          />
          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
              flujo.activo ? "border-success text-success" : "border-border text-muted"
            }`}
          >
            {flujo.activo ? "Activo" : "Borrador"}
          </span>
          <ActivarFlujo flujoId={id} activo={Boolean(flujo.activo)} />
        </div>
      </div>

      <LienzoFlujo
        flujoId={id}
        nodosIniciales={nodosIniciales}
        conexionesIniciales={conexionesIniciales}
        etiquetas={etiquetas ?? []}
        catalogos={{
          etiquetas: etiquetas ?? [],
          // Las plantillas que se pasan del limite de WhatsApp no se ofrecen:
          // elegirlas seria armar un flujo que falla en cada envio.
          plantillas: (plantillas ?? []).filter((p) => !noSePuedeUsar(p.body_text)),
          agentes,
          respuestasRapidas: respuestasRapidas ?? [],
          automatizaciones: automatizaciones ?? [],
          flujos: otrosFlujos ?? [],
        }}
      />

      <p className="text-[11.5px] leading-relaxed text-muted">
        Mientras está en borrador no le llega a nadie. Al activarlo, los contactos que cumplan el disparador
        entran al flujo: mientras están dentro, las automatizaciones, los seguimientos y el agente de IA no
        responden, para que no se crucen los mensajes.
      </p>
    </div>
  );
}
