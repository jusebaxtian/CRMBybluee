import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const activar = vi.hoisted(() => vi.fn(async () => ({ planAplicado: true })));
vi.mock("@/lib/billing/activar", () => ({ activarPorPago: activar }));

import { aplicarTransaccionWompi } from "./wompi-pago";

type Pago = { id: string; workspace_id: string; provider: string; status: string; amount_cents: number; currency: string; plan_id: string | null };

/** Base falsa: una fila de pagos y el rastro de las actualizaciones. */
function baseFalsa(pago: Pago | null, ganaLaCarrera = true) {
  const updates: Record<string, unknown>[] = [];
  const db = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: pago }) }) }),
      update: (v: Record<string, unknown>) => {
        updates.push(v);
        const q = { eq: () => q, select: async () => ({ data: ganaLaCarrera ? [{ id: "p1" }] : [] }), then: undefined as unknown };
        return Object.assign(Promise.resolve({ error: null }), q);
      },
    }),
  };
  return { db: db as unknown as SupabaseClient, updates };
}

const pendiente: Pago = { id: "p1", workspace_id: "w1", provider: "wompi", status: "pending", amount_cents: 4990000, currency: "COP", plan_id: "pl" };
const tx = (o = {}) => ({ id: "t1", status: "APPROVED", reference: "bbl-x", amount_in_cents: 4990000, currency: "COP", ...o });

describe("aplicarTransaccionWompi", () => {
  it("aprueba y activa una sola vez", async () => {
    activar.mockClear();
    const { db } = baseFalsa(pendiente);
    expect(await aplicarTransaccionWompi(db, tx())).toBe("aprobado");
    expect(activar).toHaveBeenCalledTimes(1);
  });

  it("no activa si otro proceso ya lo aprobó (carrera webhook/regreso)", async () => {
    activar.mockClear();
    const { db } = baseFalsa(pendiente, false);
    expect(await aplicarTransaccionWompi(db, tx())).toBe("aprobado");
    expect(activar).not.toHaveBeenCalled();
  });

  it("ignora un monto distinto al cobrado", async () => {
    activar.mockClear();
    const { db } = baseFalsa(pendiente);
    expect(await aplicarTransaccionWompi(db, tx({ amount_in_cents: 100 }))).toBe("ignorado");
    expect(activar).not.toHaveBeenCalled();
  });

  it("no toca pagos ya resueltos ni ajenos a Wompi", async () => {
    activar.mockClear();
    expect(await aplicarTransaccionWompi(baseFalsa({ ...pendiente, status: "approved" }).db, tx())).toBe("aprobado");
    expect(await aplicarTransaccionWompi(baseFalsa({ ...pendiente, provider: "bold" }).db, tx())).toBe("ignorado");
    expect(await aplicarTransaccionWompi(baseFalsa(null).db, tx())).toBe("ignorado");
    expect(activar).not.toHaveBeenCalled();
  });

  it("rechaza al declinarse y deja pendiente mientras Wompi procesa", async () => {
    const r = baseFalsa(pendiente);
    expect(await aplicarTransaccionWompi(r.db, tx({ status: "DECLINED" }))).toBe("rechazado");
    expect(r.updates[0]).toMatchObject({ status: "rejected" });
    expect(await aplicarTransaccionWompi(baseFalsa(pendiente).db, tx({ status: "PENDING" }))).toBe("pendiente");
  });
});
