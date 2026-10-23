"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/admin";
import { sendTemplateMessage } from "@/lib/whatsapp/graph";
import { ETAPAS, etapaPorClave, fechaBogota, parametrosDe, saludoDe } from "@/lib/fidelidad/etapas";
import { leerConfigFidelidad, type ConfigFidelidad } from "@/lib/fidelidad/envio";

const CLAVE_AJUSTE = "fidelidad";

/** Guarda el ajuste del plan de fidelidad. Solo el administrador de la plataforma. */
export async function guardarConfigFidelidad(entrada: ConfigFidelidad) {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: "No autorizado." };

  const telefonoPrueba = entrada.telefonoPrueba.replace(/\D/g, "");
  if (entrada.activo && !entrada.whatsappAccountId) return { error: "Elige la línea por la que salen los mensajes." };
  if (entrada.activo && entrada.modo === "prueba" && telefonoPrueba.length < 8) {
    return { error: "En modo prueba hace falta tu teléfono, con el código del país." };
  }
  const validas = new Set(ETAPAS.map((e) => e.clave));
  const config: ConfigFidelidad = {
    activo: !!entrada.activo,
    modo: entrada.modo === "real" ? "real" : "prueba",
    telefonoPrueba,
    whatsappAccountId: entrada.whatsappAccountId,
    etapasApagadas: entrada.etapasApagadas.filter((c) => validas.has(c)),
    topeDiario: Math.min(100, Math.max(1, Math.round(Number(entrada.topeDiario)) || 15)),
  };

  const admin = createAdminClient();
  const { error } = await admin
    .from("platform_settings")
    .upsert({ key: CLAVE_AJUSTE, value: JSON.stringify(config), updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) return { error: error.message };

  revalidatePath("/admin/fidelidad");
  return { success: true as const };
}

/**
 * Manda UNA plantilla de ejemplo al telefono de prueba, con datos inventados.
 * Sirve para ver como llega cada mensaje antes de encender el plan. No toca a
 * ningun cliente ni deja registro de envio.
 */
export async function enviarEjemploDeFidelidad(clave: string) {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: "No autorizado." };

  const etapa = etapaPorClave(clave);
  if (!etapa) return { error: "Etapa desconocida." };

  const admin = createAdminClient();
  const config = await leerConfigFidelidad(admin);
  if (!config.whatsappAccountId) return { error: "Elige primero la línea y guarda." };
  if (config.telefonoPrueba.length < 8) return { error: "Escribe tu teléfono de prueba y guarda." };

  const { data: cuenta } = await admin
    .from("whatsapp_accounts")
    .select("phone_number_id, access_token, status")
    .eq("id", config.whatsappAccountId)
    .maybeSingle();
  if (!cuenta || cuenta.status === "frozen") return { error: "La línea elegida no está disponible." };

  const hoy = fechaBogota(new Date());
  const parametros = parametrosDe(etapa, {
    saludo: saludoDe("Carlos", "Tienda Angelita"),
    negocio: "Tienda Angelita",
    correo: "carlos@tiendaangelita.com",
    vencimiento: hoy,
    hoy,
    diasDemo: 2,
  });

  try {
    await sendTemplateMessage(cuenta.phone_number_id, cuenta.access_token, config.telefonoPrueba, etapa.plantilla, "es", parametros);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo enviar." };
  }
  return { success: true as const };
}
