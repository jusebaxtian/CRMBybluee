/**
 * Pagos en linea de Bold (migracion 0180): lo que llega por el webhook, de
 * cualquier producto, y como se muestra en Admin -> Pagos.
 */

export type EventoBold = "SALE_APPROVED" | "SALE_REJECTED" | "VOID_APPROVED" | "VOID_REJECTED";
export type EstadoBold = "aprobado" | "rechazado" | "anulado" | "anulacion_rechazada";

export const ESTADO_DE_EVENTO: Record<EventoBold, EstadoBold> = {
  SALE_APPROVED: "aprobado",
  SALE_REJECTED: "rechazado",
  VOID_APPROVED: "anulado",
  VOID_REJECTED: "anulacion_rechazada",
};

/**
 * Bold puede repetir avisos y mandarlos en desorden. Una anulacion aprobada no
 * la deshace un aviso de venta que llegue tarde; una anulacion rechazada deja
 * la venta como aprobada.
 */
export function estadoTrasEvento(anterior: EstadoBold | null, evento: EventoBold): EstadoBold {
  const nuevo = ESTADO_DE_EVENTO[evento];
  if (anterior === "anulado") return "anulado";
  if (nuevo === "anulacion_rechazada") return anterior === "rechazado" ? "rechazado" : "aprobado";
  return nuevo;
}

export type PayloadBold = {
  id?: string;
  type: EventoBold;
  subject?: string;
  data?: {
    payment_id?: string;
    created_at?: string;
    amount?: { currency?: string; total?: number };
    metadata?: { reference?: string | null };
    payer_email?: string | null;
    payment_method?: string | null;
    integration?: string | null;
  };
};

/** Lo que se guarda de un aviso. null si no trae con que identificar el pago. */
export function filaDeAviso(p: PayloadBold) {
  const paymentId = p.data?.payment_id || p.subject;
  if (!paymentId || !(p.type in ESTADO_DE_EVENTO)) return null;
  const fecha = p.data?.created_at ? new Date(p.data.created_at) : null;
  return {
    payment_id: paymentId,
    ultimo_evento: p.type,
    monto: typeof p.data?.amount?.total === "number" ? p.data.amount.total : null,
    currency: p.data?.amount?.currency ?? null,
    metodo: p.data?.payment_method ?? null,
    integracion: p.data?.integration ?? null,
    referencia: p.data?.metadata?.reference ?? null,
    correo_pagador: p.data?.payer_email ?? null,
    pagado_el: fecha && !Number.isNaN(fecha.getTime()) ? fecha.toISOString() : null,
  };
}

export const NOMBRE_METODO: Record<string, string> = {
  CARD: "Tarjeta (datáfono)",
  CARD_WEB: "Tarjeta",
  BOLD_TAP: "Bold Tap",
  NEQUI: "Nequi",
  BOTON_BANCOLOMBIA: "Bancolombia",
  PSE: "PSE",
  QR: "QR",
};

export const NOMBRE_CANAL: Record<string, string> = {
  LINK: "Link de pago",
  BUTTON: "Botón de pago",
  POS: "Datáfono",
  BOLD_TAP: "Bold Tap",
  API_INTEGRATIONS: "API",
  APP_LINK: "App",
};

/** Que se vendio, segun la referencia: plan o curso del CRM, o un pago externo. */
export function productoDeReferencia(
  referencia: string | null,
  planPorOrden: Map<string, string>,
  cursoPorOrden: Map<string, string>
): { tipo: "plan" | "curso" | "link" | "otro"; texto: string } {
  if (referencia && planPorOrden.has(referencia)) return { tipo: "plan", texto: planPorOrden.get(referencia)! };
  if (referencia && cursoPorOrden.has(referencia)) return { tipo: "curso", texto: cursoPorOrden.get(referencia)! };
  if (referencia?.startsWith("LNK_")) return { tipo: "link", texto: "Link de pago" };
  return { tipo: "otro", texto: "Otro pago en Bold" };
}
