import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId, getWorkspaceRole } from "@/lib/workspace";
import { bogotaYesterdayRange } from "@/lib/reports/day";

export async function GET() {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) {
    return NextResponse.json({ error: "No se encontró tu workspace." }, { status: 401 });
  }

  const role = await getWorkspaceRole(supabase, workspaceId);
  if (role !== "owner" && role !== "admin") {
    return NextResponse.json({ error: "No tienes permiso para exportar reportes." }, { status: 403 });
  }

  const { ymd, startIso, endIso } = bogotaYesterdayRange();

  const { data: contacts } = await supabase
    .from("contacts")
    .select("wa_id, name, notes, created_at, contact_tags(tags(name))")
    .eq("workspace_id", workspaceId)
    .gte("created_at", startIso)
    .lte("created_at", endIso)
    .order("created_at", { ascending: true });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Personas de ayer");

  sheet.columns = [
    { header: "Hora de llegada", key: "created_at", width: 20 },
    { header: "Teléfono / Usuario", key: "wa_id", width: 22 },
    { header: "Nombre", key: "name", width: 28 },
    { header: "Etiquetas", key: "tags", width: 28 },
    { header: "Notas", key: "notes", width: 40 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const c of contacts ?? []) {
    const tagNames = ((c.contact_tags ?? []) as unknown as { tags: { name: string } | null }[])
      .map((ct) => ct.tags?.name)
      .filter(Boolean)
      .join(", ");

    sheet.addRow({
      created_at: new Date(c.created_at).toLocaleString("es-CO", { timeZone: "America/Bogota" }),
      wa_id: c.wa_id,
      name: c.name ?? "",
      tags: tagNames,
      notes: c.notes ?? "",
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `personas-ayer-${ymd}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
