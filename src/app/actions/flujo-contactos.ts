"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspaceId, getWorkspaceRole } from "@/lib/workspace";
import { forzarAvance, sacarDelFlujo } from "@/lib/flujos/motor";
import { nombreDeBloque, opcionesDeAvance, type OpcionDeAvance } from "@/lib/flujos/gestion";
import type { DatosBloque, TipoBloque } from "@/lib/flujos/bloques";

/** Tope de la lista: los flujos con mas contactos dentro se filtran en el servidor. */
const MAXIMO_EN_LISTA = 500;
const ESTADOS_ACTIVOS = ["corriendo", "esperando"];

export type ContactoEnFlujo = {
  ejecucionId: string;
  nombre: string | null;
  waId: string;
  conversationId: string | null;
  nodoId: string | null;
  bloque: string;
  estado: string;
  entro: string;
  vence: string;
};

/**
 * El dueno y los administradores gestionan todo el flujo; un asesor o vendedor,
 * solo los contactos con el chat asignado a el. Se lee con la llave de servicio
 * porque los recorridos no se pueden escribir con la sesion: por eso cada accion
 * revisa aqui que el flujo sea del espacio de quien la pide.
 */
async function autorizar(flujoId: string) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return null;
  const { data: flujo } = await supabase.from("flujos").select("id").eq("id", flujoId).eq("workspace_id", workspaceId).maybeSingle();
  if (!flujo) return null;
  const rol = await getWorkspaceRole(supabase, workspaceId);
  if (!rol) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { admin: createAdminClient(), workspaceId, veTodo: rol === "owner" || rol === "admin", userId: user.id };
}

type Permiso = NonNullable<Awaited<ReturnType<typeof autorizar>>>;

/** De estos recorridos, los que siguen activos en este flujo y esta persona puede tocar. */
async function recorridosPermitidos(p: Permiso, flujoId: string, ejecucionIds: string[]): Promise<string[]> {
  if (ejecucionIds.length === 0) return [];
  const { data } = await p.admin
    .from("flujo_ejecuciones")
    .select("id, conversations(assigned_agent_id)")
    .eq("flujo_id", flujoId)
    .eq("workspace_id", p.workspaceId)
    .in("estado", ESTADOS_ACTIVOS)
    .in("id", ejecucionIds);
  return (data ?? [])
    .filter((e) => p.veTodo || (e.conversations as unknown as { assigned_agent_id: string | null } | null)?.assigned_agent_id === p.userId)
    .map((e) => e.id as string);
}

export async function listarContactosDelFlujo(flujoId: string): Promise<
  | { error: string }
  | { contactos: ContactoEnFlujo[]; opcionesPorBloque: Record<string, OpcionDeAvance[]>; opcionesSinBloque: OpcionDeAvance[]; total: number; veTodo: boolean }
> {
  const p = await autorizar(flujoId);
  if (!p) return { error: "No tienes acceso a este flujo." };

  const [{ data: filas, error }, { data: nodos }, { data: conexiones }] = await Promise.all([
    p.admin
      .from("flujo_ejecuciones")
      .select("id, conversation_id, nodo_id, estado, iniciado_el, vence_el, contacts(name, wa_id), conversations(assigned_agent_id)")
      .eq("flujo_id", flujoId)
      .eq("workspace_id", p.workspaceId)
      .in("estado", ESTADOS_ACTIVOS)
      .order("iniciado_el", { ascending: false })
      .limit(MAXIMO_EN_LISTA),
    p.admin.from("flujo_nodos").select("id, tipo, datos").eq("flujo_id", flujoId),
    p.admin.from("flujo_conexiones").select("origen_id, destino_id, salida").eq("flujo_id", flujoId),
  ]);
  if (error) return { error: "No se pudieron cargar los contactos." };

  const bloques = (nodos ?? []).map((n) => ({ id: n.id as string, tipo: n.tipo as TipoBloque, datos: (n.datos ?? {}) as DatosBloque }));
  const lineas = (conexiones ?? []) as { origen_id: string; destino_id: string; salida: string | null }[];
  const porId = new Map(bloques.map((b) => [b.id, b]));

  const visibles = (filas ?? []).filter(
    (f) => p.veTodo || (f.conversations as unknown as { assigned_agent_id: string | null } | null)?.assigned_agent_id === p.userId
  );
  const contactos: ContactoEnFlujo[] = visibles.map((f) => {
    const contacto = f.contacts as unknown as { name: string | null; wa_id: string } | null;
    const bloque = porId.get(f.nodo_id as string);
    return {
      ejecucionId: f.id as string,
      nombre: contacto?.name ?? null,
      waId: contacto?.wa_id ?? "",
      conversationId: (f.conversation_id as string | null) ?? null,
      nodoId: bloque ? bloque.id : null,
      bloque: bloque ? nombreDeBloque(bloque) : "Perdió su bloque",
      estado: f.estado as string,
      entro: f.iniciado_el as string,
      vence: f.vence_el as string,
    };
  });

  const opcionesPorBloque: Record<string, OpcionDeAvance[]> = {};
  for (const id of new Set(contactos.map((c) => c.nodoId).filter((x): x is string => !!x))) {
    opcionesPorBloque[id] = opcionesDeAvance(id, bloques, lineas);
  }

  return {
    contactos,
    opcionesPorBloque,
    opcionesSinBloque: opcionesDeAvance(null, bloques, lineas),
    total: visibles.length,
    veTodo: p.veTodo,
  };
}

function refrescar(flujoId: string) {
  revalidatePath(`/dashboard/flujos/${flujoId}`);
  revalidatePath("/dashboard/flujos");
}

/** Saca a estos contactos: vuelven a lo normal y pueden volver a entrar. No se les envia nada. */
export async function sacarContactosDelFlujo(flujoId: string, ejecucionIds: string[]) {
  const p = await autorizar(flujoId);
  if (!p) return { error: "No tienes acceso a este flujo." };
  const permitidos = await recorridosPermitidos(p, flujoId, ejecucionIds.slice(0, MAXIMO_EN_LISTA));
  if (permitidos.length === 0) return { error: "Esos contactos ya no están en el flujo o no son tuyos." };
  for (const id of permitidos) await sacarDelFlujo(p.admin, id);
  refrescar(flujoId);
  return { success: true as const, sacados: permitidos.length, omitidos: ejecucionIds.length - permitidos.length };
}

/** Mueve a un contacto a otro bloque y lo corre desde ahi: se le envia lo que ese bloque mande. */
export async function avanzarContactoDelFlujo(flujoId: string, ejecucionId: string, destinoId: string) {
  const p = await autorizar(flujoId);
  if (!p) return { error: "No tienes acceso a este flujo." };
  const permitidos = await recorridosPermitidos(p, flujoId, [ejecucionId]);
  if (permitidos.length === 0) return { error: "Ese contacto ya no está en el flujo o no es tuyo." };

  const { data: destino } = await p.admin.from("flujo_nodos").select("tipo").eq("id", destinoId).eq("flujo_id", flujoId).maybeSingle();
  if (!destino || destino.tipo === "inicio") return { error: "Ese bloque ya no existe. Recarga la lista." };

  try {
    await forzarAvance(p.admin, ejecucionId, destinoId);
  } catch (err) {
    console.error(`flujo ${flujoId}: no se pudo avanzar la ejecucion ${ejecucionId}:`, err);
    refrescar(flujoId);
    return { error: "No se pudo enviar lo que sigue. Revisa la conversación y vuelve a intentar." };
  }
  refrescar(flujoId);
  return { success: true as const };
}
