import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/admin";
import { cargarDatosDeSoporte } from "@/lib/soporte/datos";
import { generarSoporte } from "@/lib/soporte/pdf";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Descarga de la cuenta de cobro de un pago aprobado, en PDF.
 *
 * Lo pide el cliente desde Facturacion y el administrador desde la ficha del
 * cliente. La regla de quien puede verlo vive en la seguridad de fila de la
 * tabla de pagos (ver cargarDatosDeSoporte), no aqui.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Pago no encontrado." }, { status: 404 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para descargar el soporte." }, { status: 401 });

  const soporte = await cargarDatosDeSoporte(supabase, id);
  if (!soporte) {
    // Mismo mensaje para "no existe", "no es tuyo" y "no esta aprobado": no
    // se le dice a nadie si un pago ajeno existe.
    return NextResponse.json({ error: "No hay soporte para este pago." }, { status: 404 });
  }

  // Un cliente tiene que registrar su documento antes de descargar; la pantalla
  // se lo pide. Si llega aqui sin haberlo hecho se le dice, en vez de entregarle
  // un soporte incompleto. El administrador si puede bajarlo sin ese dato.
  if (soporte.sinDocumento && !(await isPlatformAdmin(supabase))) {
    return NextResponse.json(
      { error: "Falta el NIT o la cédula del cliente.", falta: "documento" },
      { status: 409 }
    );
  }

  const pdf = await generarSoporte(soporte.datos);
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="cuenta-de-cobro-${soporte.datos.pago.numero}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
