import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verificarEventoWompi, type EventoWompi, type TransaccionWompi } from "@/lib/wompi";
import { aplicarTransaccionWompi } from "@/lib/billing/wompi-pago";

export async function POST(request: NextRequest) {
  const secreto = process.env.WOMPI_EVENTS_SECRET;
  if (!secreto) return new NextResponse("Wompi no configurado", { status: 503 });

  let evento: EventoWompi;
  try {
    evento = JSON.parse(await request.text()) as EventoWompi;
  } catch {
    return new NextResponse("Cuerpo invalido", { status: 400 });
  }

  if (!verificarEventoWompi(evento, request.headers.get("x-event-checksum"), secreto)) {
    return new NextResponse("Firma invalida", { status: 401 });
  }

  if (evento.event === "transaction.updated" && evento.data.transaction) {
    const tx = evento.data.transaction as unknown as TransaccionWompi;
    await aplicarTransaccionWompi(createAdminClient(), tx);
  }

  // Wompi reintenta si no recibe 200; los eventos que no usamos tambien se aceptan.
  return new NextResponse("OK", { status: 200 });
}
