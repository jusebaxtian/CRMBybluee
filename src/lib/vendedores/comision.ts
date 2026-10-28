/** Piezas puras de las comisiones de los vendedores (ver migracion 0158). */

export type EstadoVenta = "pendiente" | "aprobada" | "pagada" | "anulada";

/** Comision en centavos: monto x porcentaje, redondeada al peso entero. */
export function comisionCents(montoCents: number, pct: number): number {
  if (!Number.isFinite(montoCents) || !Number.isFinite(pct) || montoCents <= 0 || pct <= 0) return 0;
  return Math.round((montoCents * pct) / 100 / 100) * 100;
}

/** Porcentaje valido (0 a 100, hasta dos decimales) o null. */
export function porcentajeValido(valor: unknown): number | null {
  const n = Number(String(valor ?? "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return Math.round(n * 100) / 100;
}

export type VentaResumible = { estado: EstadoVenta; monto_cents: number; comision_cents: number; created_at: string };

export type ResumenVendedor = {
  licenciasMes: number;
  licenciasTotal: number;
  vendidoCents: number;
  /** Aprobadas y pagadas: lo que ya se gano. */
  ganadaCents: number;
  /** Aprobadas sin pagar: lo que se le debe. */
  porCobrarCents: number;
  pagadaCents: number;
  /** Registradas que el administrador aun no aprueba. */
  pendienteCents: number;
};

/**
 * Tarjetas del panel del vendedor. Las anuladas no cuentan para nada. "Este mes"
 * es el mes calendario en hora de Colombia.
 */
export function resumirVentas(ventas: VentaResumible[], ahora: Date): ResumenVendedor {
  const mes = ahora.toLocaleDateString("en-CA", { timeZone: "America/Bogota" }).slice(0, 7);
  const r: ResumenVendedor = {
    licenciasMes: 0,
    licenciasTotal: 0,
    vendidoCents: 0,
    ganadaCents: 0,
    porCobrarCents: 0,
    pagadaCents: 0,
    pendienteCents: 0,
  };
  for (const v of ventas) {
    if (v.estado === "anulada") continue;
    r.licenciasTotal++;
    if (new Date(v.created_at).toLocaleDateString("en-CA", { timeZone: "America/Bogota" }).slice(0, 7) === mes) r.licenciasMes++;
    r.vendidoCents += Number(v.monto_cents);
    if (v.estado === "pendiente") r.pendienteCents += Number(v.comision_cents);
    if (v.estado === "aprobada") {
      r.porCobrarCents += Number(v.comision_cents);
      r.ganadaCents += Number(v.comision_cents);
    }
    if (v.estado === "pagada") {
      r.pagadaCents += Number(v.comision_cents);
      r.ganadaCents += Number(v.comision_cents);
    }
  }
  return r;
}

/** Que transiciones permite el administrador desde cada estado. */
export function transicionValida(desde: EstadoVenta, hacia: EstadoVenta): boolean {
  if (desde === "pendiente") return hacia === "aprobada" || hacia === "anulada";
  if (desde === "aprobada") return hacia === "pagada" || hacia === "anulada";
  return false;
}

export const ETIQUETA_ESTADO: Record<EstadoVenta, string> = {
  pendiente: "Por aprobar",
  aprobada: "Aprobada · por pagar",
  pagada: "Pagada",
  anulada: "Anulada",
};
