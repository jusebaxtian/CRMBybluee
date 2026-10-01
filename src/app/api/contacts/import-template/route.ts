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

  // Las variables propias van con el nombre que el espacio les puso: el
  // cliente ve "Fecha de la cita" y no "Variable 2", que es lo que hace que
  // sepa que escribir debajo.
  const { data: propias } = await supabase
    .from("variables_personalizadas")
    .select("indice, nombre")
    .eq("workspace_id", workspaceId)
    .order("indice");

  const nombreDeVariable = (i: number) =>
    (propias ?? []).find((v) => v.indice === i)?.nombre?.trim() || `Variable ${i}`;

  const workbook = new ExcelJS.Workbook();

  const sheet = workbook.addWorksheet("Contactos");
  sheet.columns = [
    { header: "Celular", key: "celular", width: 20 },
    { header: "Nombre", key: "nombre", width: 26 },
    { header: "Etiquetas", key: "etiquetas", width: 30 },
    { header: nombreDeVariable(2), key: "variable2", width: 24 },
    { header: nombreDeVariable(3), key: "variable3", width: 24 },
    { header: nombreDeVariable(4), key: "variable4", width: 24 },
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
    variable2: "23 de octubre",
    variable3: "8:00 p. m.",
    variable4: "",
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
