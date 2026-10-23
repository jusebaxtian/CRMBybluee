/**
 * Las dos reglas de dinero del cambio de plan, aparte para poder probarlas.
 */

/**
 * ¿Se le pone al espacio el plan de un pago aprobado?
 *
 * Solo si lo pagado es EXACTAMENTE el precio del plan. Un pago manual lo escribe
 * el cliente: sin esta regla bastaria subir un comprobante de $1 marcado como
 * plan superior para que, al aprobarlo, el administrador regalara el plan.
 */
export function planSeAplica(precioDelPlanCents: number, montoPagadoCents: number): boolean {
  return Number(precioDelPlanCents) > 0 && Number(precioDelPlanCents) === Number(montoPagadoCents);
}

/**
 * El "siguiente nivel": el plan activo inmediatamente mas caro que el actual.
 * `planes` puede venir en cualquier orden. Si el actual ya es el mas caro, no hay.
 */
export function proximoPlan<T extends { id: string; price_cents: number }>(
  planes: T[],
  precioActualCents: number
): T | null {
  const mayores = planes.filter((p) => p.price_cents > precioActualCents);
  if (mayores.length === 0) return null;
  return mayores.reduce((a, b) => (b.price_cents < a.price_cents ? b : a));
}
