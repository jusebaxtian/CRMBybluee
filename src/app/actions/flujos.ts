"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { revisarFlujo } from "@/lib/flujos/validar";
import type { DatosBloque, TipoBloque } from "@/lib/flujos/bloques";

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

  await supabase.from("flujos").update({ updated_at: new Date().toISOString() }).eq("id", flujoId);
  revalidatePath(`/dashboard/flujos/${flujoId}`);

  // Se devuelven los avisos para pintarlos apenas guarda, sin recargar.
  const avisos = revisarFlujo(
    nodos.map((n) => ({ id: n.id, tipo: n.tipo, datos: n.datos })),
    conexiones.map((c) => ({ origen_id: c.origen, destino_id: c.destino, salida: c.salida }))
  );
  return { ok: true as const, avisos };
}
