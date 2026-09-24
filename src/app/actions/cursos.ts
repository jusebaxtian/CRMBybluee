"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/admin";
import { requireWorkspace } from "@/lib/auth/with-workspace";
import { generateBoldIntegritySignature, getBoldTransactionStatus } from "@/lib/bold";
import { origenPublico } from "@/lib/http/origen-publico";
import { toPublicUrl } from "@/lib/supabase/config";

const MAX_PORTADA_BYTES = 5 * 1024 * 1024;
const MAX_COMPROBANTE_BYTES = 5 * 1024 * 1024;

/* ------------------------------------------------------------------ admin */

async function subirPortada(file: File | null): Promise<string | null> {
  if (!file || file.size === 0) return null;
  if (file.size > MAX_PORTADA_BYTES) throw new Error("La portada no puede pesar más de 5 MB.");
  const admin = createAdminClient();
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  const path = `portadas/${crypto.randomUUID()}.${ext}`;
  const { error } = await admin.storage
    .from("cursos")
    .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
  if (error) throw new Error(`No se pudo subir la portada: ${error.message}`);
  const { data } = admin.storage.from("cursos").getPublicUrl(path);
  // getPublicUrl devuelve la URL interna del servidor (localhost:8000 detras
  // de docker); el navegador necesita el dominio publico.
  return toPublicUrl(data.publicUrl);
}

function leerCurso(formData: FormData) {
  const titulo = String(formData.get("titulo") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const datosTransferencia = String(formData.get("datosTransferencia") ?? "").trim() || null;
  const precio = Math.round(Number(formData.get("precio") ?? 0));
  const orden = Number(formData.get("orden") ?? 0) || 0;
  if (!titulo) return { error: "Escribe el título del curso." };
  if (!Number.isFinite(precio) || precio < 0) return { error: "El precio no es válido." };
  // La UI pide pesos; la base guarda centavos como el resto de la plataforma.
  return { datos: { titulo, descripcion, datos_transferencia: datosTransferencia, precio_cents: precio * 100, orden } };
}

export async function crearCurso(_prev: unknown, formData: FormData) {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: "No autorizado." };
  const r = leerCurso(formData);
  if ("error" in r) return { error: r.error };
  try {
    const portadaUrl = await subirPortada(formData.get("portada") as File | null);
    const { error } = await supabase.from("cursos").insert({ ...r.datos, portada_url: portadaUrl });
    if (error) return { error: error.message };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo crear el curso." };
  }
  revalidatePath("/admin/tutoriales");
  revalidatePath("/dashboard/tutoriales");
  return { success: true as const };
}

export async function actualizarCurso(id: string, _prev: unknown, formData: FormData) {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: "No autorizado." };
  const r = leerCurso(formData);
  if ("error" in r) return { error: r.error };
  const activo = formData.get("activo") === "on";
  try {
    const portadaUrl = await subirPortada(formData.get("portada") as File | null);
    const { error } = await supabase
      .from("cursos")
      .update({ ...r.datos, activo, ...(portadaUrl ? { portada_url: portadaUrl } : {}) })
      .eq("id", id);
    if (error) return { error: error.message };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo guardar el curso." };
  }
  revalidatePath("/admin/tutoriales");
  revalidatePath("/dashboard/tutoriales");
  return { success: true as const };
}

export async function eliminarCurso(id: string) {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: "No autorizado." };
  const { error } = await supabase.from("cursos").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/tutoriales");
  revalidatePath("/dashboard/tutoriales");
  return { success: true as const };
}

/** Aprobar o rechazar una compra por transferencia (o una de Bold pendiente). */
export async function revisarCompra(compraId: string, aprobar: boolean) {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: "No autorizado." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("curso_compras")
    .update({
      status: aprobar ? "approved" : "rejected",
      revisado_por: user?.id ?? null,
      revisado_en: new Date().toISOString(),
    })
    .eq("id", compraId);
  if (error) return { error: error.message };
  revalidatePath("/admin/tutoriales");
  revalidatePath("/dashboard/tutoriales");
  return { success: true as const };
}

/** Enlace firmado para ver el comprobante subido (bucket privado). */
export async function verComprobante(compraId: string) {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: "No autorizado." };
  const { data: compra } = await supabase
    .from("curso_compras")
    .select("proof_path")
    .eq("id", compraId)
    .maybeSingle();
  if (!compra?.proof_path) return { error: "Esta compra no tiene comprobante." };
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("payment-proofs").createSignedUrl(compra.proof_path, 300);
  if (error || !data) return { error: "No se pudo abrir el comprobante." };
  return { url: data.signedUrl };
}

/* ---------------------------------------------------------------- cliente */

/** ¿Este espacio ya tiene acceso al curso? */
export async function tieneAcceso(cursoId: string): Promise<boolean> {
  const ctx = await requireWorkspace();
  if ("error" in ctx) return false;
  const { supabase, workspaceId } = ctx;
  const { data } = await supabase
    .from("curso_compras")
    .select("id")
    .eq("curso_id", cursoId)
    .eq("workspace_id", workspaceId)
    .eq("status", "approved")
    .limit(1)
    .maybeSingle();
  return !!data;
}

/**
 * Prepara el botón de la pasarela para un curso. Mismo esquema que la
 * facturación del plan: una orden pendiente reutilizable 30 minutos.
 */
export async function crearOrdenBoldCurso(cursoId: string) {
  const ctx = await requireWorkspace();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, workspaceId } = ctx;

  const { data: curso } = await supabase
    .from("cursos")
    .select("id, titulo, precio_cents, currency, activo")
    .eq("id", cursoId)
    .maybeSingle();
  if (!curso || !curso.activo) return { error: "Curso no disponible." };
  if (curso.precio_cents <= 0) return { error: "Este curso no tiene precio configurado." };

  const { data: existente } = await supabase
    .from("curso_compras")
    .select("bold_order_id, created_at")
    .eq("workspace_id", workspaceId)
    .eq("curso_id", cursoId)
    .eq("metodo", "bold")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const reciente = existente?.bold_order_id && Date.now() - new Date(existente.created_at).getTime() < 30 * 60 * 1000;
  const orderId = reciente ? existente!.bold_order_id! : `curso-${cursoId.slice(0, 8)}-${Date.now()}`;

  // Bold espera el monto en pesos enteros, no en centavos.
  const montoBold = Math.round(curso.precio_cents / 100);
  const signature = generateBoldIntegritySignature(orderId, montoBold, curso.currency);

  if (!reciente) {
    await supabase.from("curso_compras").insert({
      curso_id: cursoId,
      workspace_id: workspaceId,
      metodo: "bold",
      monto_cents: curso.precio_cents,
      currency: curso.currency,
      status: "pending",
      bold_order_id: orderId,
    });
  }

  return {
    success: true as const,
    orderId,
    amount: montoBold,
    currency: curso.currency,
    signature,
    apiKey: process.env.NEXT_PUBLIC_BOLD_IDENTITY_KEY!,
    redirectUrl: `${await origenPublico()}/dashboard/tutoriales/curso/${cursoId}`,
    description: `Curso: ${curso.titulo}`.slice(0, 100),
  };
}

/**
 * Bold no tiene webhook en el botón de pago: vuelve con ?bold-order-id y
 * ?bold-tx-status. Se aprueba solo una orden nuestra que siga pendiente.
 */
export async function confirmarCompraBold(orderId: string, txStatus: string | null) {
  if (!orderId.startsWith("curso-")) return;
  const admin = createAdminClient();
  const { data: compra } = await admin
    .from("curso_compras")
    .select("id, status")
    .eq("bold_order_id", orderId)
    .maybeSingle();
  if (!compra || compra.status !== "pending") return;

  if (txStatus !== "approved") {
    const estado = await getBoldTransactionStatus(orderId);
    if (estado !== "APPROVED") return;
  }
  await admin
    .from("curso_compras")
    .update({ status: "approved", revisado_en: new Date().toISOString() })
    .eq("id", compra.id);
}

/** Compra por transferencia: sube el comprobante y queda pendiente de revisión. */
export async function enviarComprobanteCurso(formData: FormData) {
  const ctx = await requireWorkspace();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, workspaceId } = ctx;

  const cursoId = String(formData.get("cursoId") ?? "");
  const file = formData.get("comprobante") as File | null;
  if (!cursoId) return { error: "Curso no válido." };
  if (!file || file.size === 0) return { error: "Adjunta el comprobante de la transferencia." };
  if (file.size > MAX_COMPROBANTE_BYTES) return { error: "El comprobante no puede pesar más de 5 MB." };

  const { data: curso } = await supabase
    .from("cursos")
    .select("id, precio_cents, currency, activo")
    .eq("id", cursoId)
    .maybeSingle();
  if (!curso || !curso.activo) return { error: "Curso no disponible." };

  const admin = createAdminClient();
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  const path = `${workspaceId}/cursos/${crypto.randomUUID()}.${ext}`;
  const { error: subida } = await admin.storage
    .from("payment-proofs")
    .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
  if (subida) return { error: `No se pudo subir el comprobante: ${subida.message}` };

  const { error } = await supabase.from("curso_compras").insert({
    curso_id: cursoId,
    workspace_id: workspaceId,
    metodo: "transferencia",
    monto_cents: curso.precio_cents,
    currency: curso.currency,
    status: "pending",
    proof_path: path,
  });
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/tutoriales/curso/${cursoId}`);
  return { success: true as const };
}
