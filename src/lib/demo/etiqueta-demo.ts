import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { runTagAddedAutomations } from "@/lib/automations/engine";
import { iniciarPorEtiqueta } from "@/lib/flujos/motor";
import { saludoDe } from "@/lib/fidelidad/etapas";

/**
 * Etiqueta "DEMO" automatica en el chat del administrador.
 *
 * Cuando alguien abre una cuenta demo (enlace demo, "Registrar pago o demo"
 * del chat, o el plan DEMO asignado desde Admin) su contacto en el espacio del
 * administrador queda con la etiqueta DEMO, sin que nadie tenga que
 * acordarse. Asi se filtra, se cuenta y se les escribe como a cualquier otro
 * segmento.
 *
 * Es un trabajo de fondo que se pone al dia solo, en lugar de engancharse a
 * cada camino que crea demos: son tres (mas los que vengan), y uno que se
 * olvide dejaria cuentas demo sin etiqueta sin ningun error. El trabajo es
 * idempotente: repetirlo no cambia nada.
 *
 * Solo AGREGA la etiqueta. No la quita al pagar: la lista de etiquetas del
 * administrador tambien la usa a mano, y borrarsela a alguien sin que lo pida
 * seria tocar su trabajo.
 */

export const NOMBRE_ETIQUETA_DEMO = "DEMO";
const COLOR_ETIQUETA_DEMO = "#ec4899";

/**
 * Numero de WhatsApp tal como lo guarda `contacts.wa_id`: solo digitos, y los
 * celulares colombianos de 10 cifras con el 57 por delante. Es la misma regla
 * que `admin_telefono_normalizado` en la base (migracion 0096).
 */
export function waIdDeEspacio(phoneE164: string | null | undefined, phone: string | null | undefined): string | null {
  const digitos = (phoneE164 || phone || "").replace(/\D/g, "");
  if (!digitos) return null;
  return digitos.length === 10 ? `57${digitos}` : digitos;
}

export type EspacioDemo = { id: string; name: string; waId: string | null; clienteContactId: string | null; persona: string | null };
export type ContactoDelAdmin = { id: string; waId: string };

export type PlanDeEtiquetado = {
  /** Contactos que hay que crear (el cliente nunca le ha escrito al administrador). */
  crear: { waId: string; nombre: string }[];
  /** Contactos que ya existen y todavia no tienen la etiqueta. */
  etiquetar: string[];
};

/**
 * Que hace falta para que todos los demos queden etiquetados. Pura: recibe lo
 * que hay y devuelve lo que falta.
 */
export function planDeEtiquetado(
  demos: EspacioDemo[],
  contactos: ContactoDelAdmin[],
  yaEtiquetados: ReadonlySet<string>
): PlanDeEtiquetado {
  const porWaId = new Map(contactos.map((c) => [c.waId, c.id]));
  const idsConocidos = new Set(contactos.map((c) => c.id));
  const plan: PlanDeEtiquetado = { crear: [], etiquetar: [] };
  const yaPlanificado = new Set<string>();

  for (const demo of demos) {
    // El vinculo manual manda (es lo que el administrador fijo a mano); si no, el telefono.
    const contactoId =
      demo.clienteContactId && idsConocidos.has(demo.clienteContactId)
        ? demo.clienteContactId
        : demo.waId
          ? (porWaId.get(demo.waId) ?? null)
          : null;

    if (contactoId) {
      if (!yaEtiquetados.has(contactoId) && !yaPlanificado.has(contactoId)) {
        plan.etiquetar.push(contactoId);
        yaPlanificado.add(contactoId);
      }
    } else if (demo.waId && !plan.crear.some((c) => c.waId === demo.waId)) {
      plan.crear.push({ waId: demo.waId, nombre: saludoDe(demo.persona, demo.name) });
    }
  }
  return plan;
}

/**
 * Pone la etiqueta DEMO a los contactos de las cuentas demo vigentes.
 * Devuelve cuantos contactos etiqueto (0 casi siempre).
 */
export async function sincronizarEtiquetaDemo(admin: SupabaseClient = createAdminClient()): Promise<number> {
  // 1) Cuentas demo vigentes. Si no hay, termina aqui: es lo comun y cuesta una consulta.
  const { data: planes } = await admin.from("plans").select("id").eq("is_demo", true);
  const idsDePlan = (planes ?? []).map((p) => p.id as string);
  if (idsDePlan.length === 0) return 0;

  const { data: espacios } = await admin
    .from("workspaces")
    .select("id, name, phone, phone_e164, cliente_contact_id")
    .in("plan_id", idsDePlan)
    .eq("status", "active");
  if (!espacios || espacios.length === 0) return 0;

  // 2) El espacio del administrador (el chat donde vende).
  const { data: admins } = await admin.from("platform_admins").select("user_id");
  const { data: miembros } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("role", "owner")
    .in("user_id", (admins ?? []).map((a) => a.user_id as string));
  const espacioDelAdmin = (miembros ?? [])[0]?.workspace_id as string | undefined;
  if (!espacioDelAdmin) return 0;

  // 3) La etiqueta, creandola si no existe (si ya la hay a mano, se usa esa).
  let { data: etiqueta } = await admin
    .from("tags")
    .select("id")
    .eq("workspace_id", espacioDelAdmin)
    .eq("name", NOMBRE_ETIQUETA_DEMO)
    .maybeSingle();
  if (!etiqueta) {
    const { data: nueva } = await admin
      .from("tags")
      .upsert(
        { workspace_id: espacioDelAdmin, name: NOMBRE_ETIQUETA_DEMO, color: COLOR_ETIQUETA_DEMO },
        { onConflict: "workspace_id,name" }
      )
      .select("id")
      .single();
    etiqueta = nueva;
  }
  if (!etiqueta) return 0;

  // 4) Quien es cada demo y que contacto le corresponde.
  const duenos = await Promise.all(
    espacios.map((e) =>
      admin.from("workspace_members").select("user_id").eq("workspace_id", e.id).eq("role", "owner").limit(1).maybeSingle()
    )
  );
  const demos: EspacioDemo[] = [];
  for (let i = 0; i < espacios.length; i++) {
    const e = espacios[i];
    const userId = duenos[i].data?.user_id as string | undefined;
    const usuario = userId ? (await admin.auth.admin.getUserById(userId)).data.user : null;
    demos.push({
      id: e.id,
      name: e.name,
      waId: waIdDeEspacio(e.phone_e164, e.phone),
      clienteContactId: (e.cliente_contact_id as string | null) ?? null,
      persona: (usuario?.user_metadata?.full_name as string | undefined) ?? null,
    });
  }

  const waIds = demos.map((d) => d.waId).filter((w): w is string => !!w);
  const manuales = demos.map((d) => d.clienteContactId).filter((c): c is string => !!c);
  const filtros = [
    ...(waIds.length ? [`wa_id.in.(${waIds.join(",")})`] : []),
    ...(manuales.length ? [`id.in.(${manuales.join(",")})`] : []),
  ];
  const { data: contactos } = filtros.length
    ? await admin.from("contacts").select("id, wa_id").eq("workspace_id", espacioDelAdmin).or(filtros.join(","))
    : { data: [] as { id: string; wa_id: string }[] };

  const idsDeContactos = (contactos ?? []).map((c) => c.id as string);
  const { data: puestas } = idsDeContactos.length
    ? await admin.from("contact_tags").select("contact_id").eq("tag_id", etiqueta.id).in("contact_id", idsDeContactos)
    : { data: [] as { contact_id: string }[] };

  const plan = planDeEtiquetado(
    demos,
    (contactos ?? []).map((c) => ({ id: c.id as string, waId: c.wa_id as string })),
    new Set((puestas ?? []).map((p) => p.contact_id as string))
  );

  // 5) Crear los contactos que faltan: el demo se registro con un numero que nunca le escribio al administrador.
  const aEtiquetar = [...plan.etiquetar];
  for (const nuevo of plan.crear) {
    const { data: creado } = await admin
      .from("contacts")
      .upsert(
        { workspace_id: espacioDelAdmin, wa_id: nuevo.waId, name: nuevo.nombre, name_source: "manual" },
        { onConflict: "workspace_id,wa_id", ignoreDuplicates: true }
      )
      .select("id")
      .maybeSingle();
    if (creado) {
      aEtiquetar.push(creado.id as string);
    } else {
      // Otro proceso lo creo justo antes: se busca.
      const { data: existente } = await admin
        .from("contacts")
        .select("id")
        .eq("workspace_id", espacioDelAdmin)
        .eq("wa_id", nuevo.waId)
        .maybeSingle();
      if (existente) aEtiquetar.push(existente.id as string);
    }
  }

  // 6) Etiquetar. Se hace igual que a mano: si el administrador configuro un flujo o una
  //    automatizacion para esta etiqueta, arranca solo con los que se etiquetan ahora.
  let etiquetados = 0;
  for (const contactId of aEtiquetar) {
    const { error } = await admin.from("contact_tags").insert({ contact_id: contactId, tag_id: etiqueta.id });
    if (error) continue; // 23505: ya la tenia. Nada que hacer.
    etiquetados++;
    const loTomoUnFlujo = await iniciarPorEtiqueta(admin, espacioDelAdmin, contactId, etiqueta.id);
    if (!loTomoUnFlujo) await runTagAddedAutomations(admin, espacioDelAdmin, contactId, etiqueta.id);
  }
  if (etiquetados > 0) console.log(`etiqueta DEMO: ${etiquetados} contacto(s) etiquetado(s)`);
  return etiquetados;
}
