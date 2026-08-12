import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";

export async function GET() {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) {
    return NextResponse.json({ error: "No se encontró tu workspace." }, { status: 401 });
  }

  const workbook = new ExcelJS.Workbook();

  const sheet = workbook.addWorksheet("Contactos");
  sheet.columns = [
    { header: "Celular", key: "celular", width: 20 },
    { header: "Nombre", key: "nombre", width: 26 },
    { header: "Etiquetas", key: "etiquetas", width: 30 },
  ];
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1BA84A" },
  };
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  sheet.addRow({ celular: "3001234567", nombre: "Juan Pérez", etiquetas: "Clientes VIP, Interesados" });
  sheet.addRow({ celular: "573007654321", nombre: "María Gómez", etiquetas: "" });

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="plantilla-contactos.xlsx"`,
    },
  });
}
