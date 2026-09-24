"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/admin";
import { MODULOS_TUTORIAL } from "@/lib/tutoriales/video";

function leer(formData: FormData) {
  const titulo = String(formData.get("titulo") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const url = String(formData.get("url") ?? "").trim();
  const modulo = String(formData.get("modulo") ?? "empezar");
  const duracion = String(formData.get("duracion") ?? "").trim() || null;
  const orden = Number(formData.get("orden") ?? 0) || 0;
  const cursoId = String(formData.get("cursoId") ?? "") || null;
  if (!titulo) return { error: "Escribe el título." };
  if (!/^https?:\/\//.test(url)) return { error: "La URL debe empezar por http:// o https://" };
  if (!MODULOS_TUTORIAL.some((m) => m.value === modulo)) return { error: "Módulo no válido." };
  return { datos: { titulo, descripcion, url, modulo, duracion, orden, curso_id: cursoId } };
}

export async function crearTutorial(_prev: unknown, formData: FormData) {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: "No autorizado." };
  const r = leer(formData);
  if ("error" in r) return { error: r.error };
  const { error } = await supabase.from("tutoriales").insert(r.datos);
  if (error) return { error: error.message };
  revalidatePath("/admin/tutoriales");
  revalidatePath("/dashboard/tutoriales");
  return { success: true as const };
}

export async function actualizarTutorial(id: string, _prev: unknown, formData: FormData) {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: "No autorizado." };
  const r = leer(formData);
  if ("error" in r) return { error: r.error };
  const activo = formData.get("activo") === "on";
  const { error } = await supabase.from("tutoriales").update({ ...r.datos, activo }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/tutoriales");
  revalidatePath("/dashboard/tutoriales");
  return { success: true as const };
}

export async function eliminarTutorial(id: string) {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: "No autorizado." };
  const { error } = await supabase.from("tutoriales").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/tutoriales");
  revalidatePath("/dashboard/tutoriales");
  return { success: true as const };
}
