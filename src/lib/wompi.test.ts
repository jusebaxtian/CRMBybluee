import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { firmaDeIntegridadWompi, verificarEventoWompi, type EventoWompi } from "./wompi";

const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

describe("firmaDeIntegridadWompi", () => {
  it("concatena referencia, monto, moneda y secreto", () => {
    expect(firmaDeIntegridadWompi("ref-1", 4990000, "COP", "sec")).toBe(sha("ref-14990000COPsec"));
  });
});

describe("verificarEventoWompi", () => {
  const secreto = "prod_events_abc";
  const evento = (checksum: string): EventoWompi => ({
    event: "transaction.updated",
    data: { transaction: { id: "1234-1610641025-49201", status: "APPROVED", amount_in_cents: 4490000 } },
    timestamp: 1530291411,
    signature: {
      properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents"],
      checksum,
    },
  });
  const bueno = sha(`1234-1610641025-49201APPROVED44900001530291411${secreto}`);

  it("acepta un checksum correcto", () => {
    expect(verificarEventoWompi(evento(bueno), null, secreto)).toBe(true);
    expect(verificarEventoWompi(evento(bueno.toUpperCase()), null, secreto)).toBe(true);
  });

  it("usa el encabezado si el cuerpo no trae checksum", () => {
    const e = evento("");
    delete e.signature!.checksum;
    expect(verificarEventoWompi(e, bueno, secreto)).toBe(true);
  });

  it("rechaza checksum falso, secreto distinto o datos alterados", () => {
    expect(verificarEventoWompi(evento("0".repeat(64)), null, secreto)).toBe(false);
    expect(verificarEventoWompi(evento(bueno), null, "otro")).toBe(false);
    const alterado = evento(bueno);
    (alterado.data.transaction as Record<string, unknown>).status = "DECLINED";
    expect(verificarEventoWompi(alterado, null, secreto)).toBe(false);
  });

  it("rechaza si falta firma", () => {
    expect(verificarEventoWompi({ event: "x", data: {}, timestamp: 1 }, null, secreto)).toBe(false);
  });
});
