import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { requireModule } from "@/lib/entitlements";
import { NO_WORKSPACE_ERROR } from "@/lib/auth/with-workspace";
import { resolveSendAccount } from "@/lib/whatsapp/account";

const ESTADO: Record<string, string> = {
  pending: "Pendiente",
  sent: "Enviado",
  delivered: "Entregado",
  read: "Leído",
  failed: "Falló",
};

function fechaCo(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Excel de una campaña: fecha de envío, línea saliente, destino, plantilla y estado por contacto. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return NextResponse.json({ error: NO_WORKSPACE_ERROR }, { status: 401 });
  await requireModule(supabase, workspaceId, "campaigns");

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, name, send_type, started_at, whatsapp_account_id, templates(meta_template_name)")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!campaign) return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });

  // Misma linea que uso el envio: la elegida en la campaña o, si no, la
  // primera conectada del espacio.
  const cuenta = await resolveSendAccount(supabase, workspaceId, campaign.whatsapp_account_id);
  let numeroSaliente = "";
  if (cuenta) {
    const { data } = await supabase
      .from("whatsapp_accounts")
      .select("display_phone_number")
      .eq("id", cuenta.id)
      .maybeSingle();
    numeroSaliente = data?.display_phone_number ?? "";
  }

  const template = campaign.templates as unknown as { meta_template_name: string } | null;
  const plantilla = campaign.send_type === "free_text" ? "Mensaje libre" : (template?.meta_template_name ?? "");

  type Fila = { status: string; sent_at: string | null; contacts: { wa_id: string } | null };
  const filas: Fila[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data: batch } = await supabase
      .from("campaign_recipients")
      .select("status, sent_at, contacts(wa_id)")
      .eq("campaign_id", id)
      .order("sent_at", { ascending: true, nullsFirst: false })
      .range(offset, offset + 999);
    if (!batch || batch.length === 0) break;
    filas.push(...(batch as unknown as Fila[]));
    if (batch.length < 1000) break;
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Envíos");
  sheet.columns = [
    { header: "Fecha de envío", key: "fecha", width: 20 },
    { header: "Número saliente API", key: "saliente", width: 22 },
    { header: "Número destino", key: "destino", width: 20 },
    { header: "Plantilla", key: "plantilla", width: 30 },
    { header: "Estado", key: "estado", width: 14 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.autoFilter = "A1:E1";

  for (const f of filas) {
    sheet.addRow({
      fecha: fechaCo(f.sent_at ?? (f.status === "pending" ? null : campaign.started_at)),
      saliente: numeroSaliente,
      destino: f.contacts?.wa_id ?? "",
      plantilla,
      estado: ESTADO[f.status] ?? f.status,
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const nombre = campaign.name.replace(/[^\p{L}\p{N}_-]+/gu, "-").slice(0, 60) || "campana";
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="campana-${nombre}.xlsx"`,
    },
  });
}
