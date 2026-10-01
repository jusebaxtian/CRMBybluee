"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { revisarFlujo } from "@/lib/flujos/validar";
import type { DatosBloque, TipoBloque } from "@/lib/flujos/bloques";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Guardado del lienzo.
 *
 * El dibujo se guarda entero de una vez --se borran los bloques y conexiones
 * y se vuelven a escribir-- en vez de ir anotando cada movimiento. Un flujo
 * son decenas de filas, no miles, y asi no hay forma de que queden conexiones
 * apuntando a bloques que el usuario ya borro.
 */

export type NodoGuardar = { id: string; tipo: TipoBloque; datos: DatosBloque; x: number; y: number };
export type ConexionGuardar = { origen: string; destino: string; salida: string | null };

async function flujoDelEspacio(flujoId: string) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "Sin espacio de trabajo." as const };

  const { data: flujo } = await supabase
    .from("flujos")
    .select("id, workspace_id")
    .eq("id", flujoId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!flujo) return { error: "Flujo no encontrado." as const };

  return { supabase, workspaceId };
}

export async function crearFlujo(nombre: string) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "Sin espacio de trabajo." };

  const limpio = nombre.trim();
  if (!limpio) return { error: "Ponle un nombre al flujo." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: flujo, error } = await supabase
    .from("flujos")
    .insert({ workspace_id: workspaceId, nombre: limpio, created_by: user?.id ?? null })
    .select("id")
    .single();
  if (error) return { error: error.message };

  // Todo flujo nace con su bloque de inicio: sin el no hay por donde entrar,
  // y pedirselo al usuario es pedirle que entienda el modelo antes de dibujar.
  await supabase.from("flujo_nodos").insert({
    flujo_id: flujo.id,
    tipo: "inicio",
    datos: {},
    pos_x: 80,
    pos_y: 160,
  });

  revalidatePath("/dashboard/flujos");
  return { id: flujo.id as string };
}

export async function renombrarFlujo(flujoId: string, nombre: string) {
  const ctx = await flujoDelEspacio(flujoId);
  if ("error" in ctx) return ctx;
  const limpio = nombre.trim();
  if (!limpio) return { error: "El nombre no puede quedar vacío." };

  const { error } = await ctx.supabase.from("flujos").update({ nombre: limpio, updated_at: new Date().toISOString() }).eq("id", flujoId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/flujos");
  return { ok: true as const };
}

export async function eliminarFlujo(flujoId: string) {
  const ctx = await flujoDelEspacio(flujoId);
  if ("error" in ctx) return ctx;
  const { error } = await ctx.supabase.from("flujos").delete().eq("id", flujoId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/flujos");
  return { ok: true as const };
}

export async function guardarLienzo(
  flujoId: string,
  nodos: NodoGuardar[],
  conexiones: ConexionGuardar[]
) {
  const ctx = await flujoDelEspacio(flujoId);
  if ("error" in ctx) return ctx;
  const { supabase } = ctx;

  if (!nodos.some((n) => n.tipo === "inicio")) {
    return { error: "El flujo se quedó sin bloque de inicio." };
  }

  await supabase.from("flujo_conexiones").delete().eq("flujo_id", flujoId);
  await supabase.from("flujo_nodos").delete().eq("flujo_id", flujoId);

  const { data: insertados, error: errorNodos } = await supabase
    .from("flujo_nodos")
    .insert(
      nodos.map((n) => ({
        flujo_id: flujoId,
        tipo: n.tipo,
        datos: n.datos,
        pos_x: n.x,
        pos_y: n.y,
      }))
    )
    .select("id");
  if (errorNodos) return { error: errorNodos.message };

  // Los ids del lienzo son del navegador; los de la base son nuevos. Se
  // emparejan por orden, que es el mismo en el que se insertaron.
  const idNuevo = new Map<string, string>();
  nodos.forEach((n, i) => {
    const fila = (insertados ?? [])[i];
    if (fila) idNuevo.set(n.id, fila.id as string);
  });

  const filasConexion = conexiones
    .map((c) => ({
      flujo_id: flujoId,
      origen_id: idNuevo.get(c.origen),
      destino_id: idNuevo.get(c.destino),
      salida: c.salida,
    }))
    .filter((c): c is { flujo_id: string; origen_id: string; destino_id: string; salida: string | null } =>
      Boolean(c.origen_id && c.destino_id)
    );

  if (filasConexion.length > 0) {
    const { error: errorConexiones } = await supabase.from("flujo_conexiones").insert(filasConexion);
    if (errorConexiones) return { error: errorConexiones.message };
  }

  // Los disparadores se editan en el bloque de inicio pero viven en su propia
  // tabla: es lo que el motor consultara para saber que flujo arrancar con un
  // mensaje entrante, sin tener que leer el grafo completo de cada flujo.
  const inicio = nodos.find((n) => n.tipo === "inicio");
  const disparadores = (inicio?.datos.disparadores ?? []).filter((d) => {
    if (d.tipo === "keyword" || d.tipo === "button_tap") return Boolean(d.valor?.trim());
    if (d.tipo === "tag") return Boolean(d.tagId);
    return true;
  });

  await supabase.from("flujo_disparadores").delete().eq("flujo_id", flujoId);
  if (disparadores.length > 0) {
    const { error: errorDisparadores } = await supabase.from("flujo_disparadores").insert(
      disparadores.map((d) => ({
        flujo_id: flujoId,
        tipo: d.tipo,
        valor: d.tipo === "keyword" || d.tipo === "button_tap" ? d.valor?.trim() ?? null : null,
        tag_id: d.tipo === "tag" ? d.tagId ?? null : null,
      }))
    );
    if (errorDisparadores) return { error: errorDisparadores.message };
  }

  await supabase.from("flujos").update({ updated_at: new Date().toISOString() }).eq("id", flujoId);
  revalidatePath(`/dashboard/flujos/${flujoId}`);

  // Se devuelven los avisos para pintarlos apenas guarda, sin recargar.
  const avisos = revisarFlujo(
    nodos.map((n) => ({ id: n.id, tipo: n.tipo, datos: n.datos })),
    conexiones.map((c) => ({ origen_id: c.origen, destino_id: c.destino, salida: c.salida }))
  );
  return { ok: true as const, avisos };
}

/**
 * Activar o pausar un flujo.
 *
 * Activar es lo que lo pone a correr de verdad, asi que aqui se repite la
 * revision completa: en el lienzo se avisa mientras se dibuja, pero el aviso
 * en pantalla no sirve de nada si despues se puede activar igual.
 */
export async function activarFlujo(flujoId: string, activo: boolean) {
  const ctx = await flujoDelEspacio(flujoId);
  if ("error" in ctx) return ctx;
  const { supabase } = ctx;

  if (activo) {
    const [{ data: nodos }, { data: conexiones }, { data: disparadores }] = await Promise.all([
      supabase.from("flujo_nodos").select("id, tipo, datos").eq("flujo_id", flujoId),
      supabase.from("flujo_conexiones").select("origen_id, destino_id, salida").eq("flujo_id", flujoId),
      supabase.from("flujo_disparadores").select("tipo, valor, tag_id").eq("flujo_id", flujoId),
    ]);

    if ((disparadores ?? []).length === 0) {
      return { error: "Ponle un disparador al bloque de inicio: sin eso nadie entra al flujo." };
    }

    const avisos = revisarFlujo(
      (nodos ?? []).map((n) => ({
        id: n.id as string,
        tipo: n.tipo as TipoBloque,
        datos: {
          ...((n.datos ?? {}) as DatosBloque),
          // Los disparadores viven aparte: se le devuelven al inicio para que
          // la revision los vea.
          ...(n.tipo === "inicio"
            ? {
                disparadores: (disparadores ?? []).map((d) => ({
                  tipo: d.tipo as "keyword" | "any_message" | "first_message_of_day" | "tag" | "manual",
                  valor: (d.valor as string | null) ?? undefined,
                  tagId: (d.tag_id as string | null) ?? undefined,
                })),
              }
            : {}),
        },
      })),
      (conexiones ?? []).map((c) => ({
        origen_id: c.origen_id as string,
        destino_id: c.destino_id as string,
        salida: (c.salida as string | null) ?? null,
      }))
    );

    const errores = avisos.filter((a) => a.nivel === "error");
    if (errores.length > 0) {
      return { error: `No se puede activar: ${errores[0].texto}` };
    }
  }

  const { error } = await supabase
    .from("flujos")
    .update({ activo, updated_at: new Date().toISOString() })
    .eq("id", flujoId);
  if (error) return { error: error.message };

  // Al pausar, los contactos que iban a medias se quedan dentro sin que nadie
  // los mueva: se cierran para que recuperen sus seguimientos y su IA.
  if (!activo) {
    await supabase
      .from("flujo_ejecuciones")
      .update({ estado: "cancelado", terminado_el: new Date().toISOString() })
      .eq("flujo_id", flujoId)
      .in("estado", ["corriendo", "esperando"]);
  }

  revalidatePath(`/dashboard/flujos/${flujoId}`);
  revalidatePath("/dashboard/flujos");
  return { ok: true as const };
}

/** Por qué línea de WhatsApp sale este flujo. */
export async function guardarLineaDelFlujo(flujoId: string, whatsappAccountId: string | null) {
  const ctx = await flujoDelEspacio(flujoId);
  if ("error" in ctx) return ctx;

  const { error } = await ctx.supabase
    .from("flujos")
    .update({ whatsapp_account_id: whatsappAccountId, updated_at: new Date().toISOString() })
    .eq("id", flujoId);
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/flujos/${flujoId}`);
  return { ok: true as const };
}

/**
 * Mete al contacto a un flujo desde el chat.
 *
 * Solo para flujos activos que tengan el disparador de entrada manual. El
 * motivo del "no" se devuelve tal cual para mostrarlo: un agente tiene que
 * saber si el flujo está en borrador o si el contacto ya está en otro.
 */
export async function meterContactoEnFlujo(flujoId: string, contactId: string, conversationId: string | null) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "Sin espacio de trabajo." };

  const { data: flujo } = await supabase
    .from("flujos")
    .select("id")
    .eq("id", flujoId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!flujo) return { error: "Flujo no encontrado." };

  const { data: contacto } = await supabase
    .from("contacts")
    .select("id")
    .eq("id", contactId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!contacto) return { error: "Contacto no encontrado." };

  // El motor escribe con la llave de servicio: mueve al contacto, manda
  // mensajes y programa esperas, que no es algo que deba poder hacer el
  // navegador por su cuenta.
  const { iniciarAMano } = await import("@/lib/flujos/motor");
  const resultado = await iniciarAMano(createAdminClient(), flujoId, contactId, conversationId);
  if (!resultado.ok) return { error: resultado.motivo };

  revalidatePath(`/dashboard/inbox/${conversationId ?? ""}`);
  return { ok: true as const };
}
