"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspaceRole } from "@/lib/auth/with-workspace";
import { aMinutos } from "@/lib/silencio";

/** Guarda el horario de silencio del espacio (0192). Solo dueño o administrador. */
export async function guardarHorarioDeSilencio(entrada: { activo: boolean; inicio: string; fin: string }) {
  const ctx = await requireWorkspaceRole(["owner", "admin"], "Solo el dueño o un administrador puede cambiar el horario de silencio.");
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, workspaceId } = ctx;

  const inicio = aMinutos(entrada.inicio);
  const fin = aMinutos(entrada.fin);
  if (inicio === null || fin === null) return { error: "Escribe las horas en formato 24 h, por ejemplo 22:00 y 05:00." };
  if (inicio === fin) return { error: "La hora de inicio y la de fin no pueden ser iguales." };

  const dos = (n: number) => String(n).padStart(2, "0");
  const hhmm = (m: number) => `${dos(Math.floor(m / 60))}:${dos(m % 60)}`;

  const { error } = await supabase
    .from("workspaces")
    .update({ silencio_activo: entrada.activo, silencio_inicio: hhmm(inicio), silencio_fin: hhmm(fin) })
    .eq("id", workspaceId);
  if (error) return { error: "No se pudo guardar el horario." };
  revalidatePath("/dashboard/settings");
  return { success: true as const };
}
