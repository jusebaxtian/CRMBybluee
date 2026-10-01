import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { NO_WORKSPACE_ERROR } from "@/lib/auth/with-workspace";

export async function GET() {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) {
    return NextResponse.json({ error: NO_WORKSPACE_ERROR }, { status: 401 });
  }

  // Las tres columnas propias van con el nombre que el espacio les puso: el
  // cliente ve "Fecha de la cita" y no "Columna 2", que es lo que hace que
  // sepa que escribir debajo.
  const { data: campos } = await supabase
    .from("campos_personalizados")
    .select("indice, nombre")
    .eq("workspace_id", workspaceId)
    .order("indice");

  const nombreDeCampo = (i: number) =>
    (campos ?? []).find((c) => c.indice === i)?.nombre?.trim() || `Columna ${i}`;

  const workbook = new ExcelJS.Workbook();

  const sheet = workbook.addWorksheet("Contactos");
  sheet.columns = [
    { header: "Celular", key: "celular", width: 20 },
    { header: "Nombre", key: "nombre", width: 26 },
    { header: "Etiquetas", key: "etiquetas", width: 30 },
    { header: nombreDeCampo(1), key: "campo1", width: 24 },
    { header: nombreDeCampo(2), key: "campo2", width: 24 },
    { header: nombreDeCampo(3), key: "campo3", width: 24 },
  ];
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1BA84A" },
  };
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  sheet.addRow({
    celular: "3001234567",
    nombre: "Juan Pérez",
    etiquetas: "Clientes VIP, Interesados",
    campo1: "23 de octubre",
    campo2: "8:00 p. m.",
    campo3: "",
  });
  sheet.addRow({ celular: "573007654321", nombre: "María Gómez", etiquetas: "" });

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="plantilla-contactos.xlsx"`,
    },
  });
}
