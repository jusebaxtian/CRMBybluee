import { describe, expect, it } from "vitest";
import { estadoTrasEvento, filaDeAviso, productoDeReferencia } from "./bold-pagos";

describe("estadoTrasEvento", () => {
  it("una venta aprobada queda aprobada", () => {
    expect(estadoTrasEvento(null, "SALE_APPROVED")).toBe("aprobado");
  });
  it("una anulacion gana aunque despues llegue tarde el aviso de venta", () => {
    expect(estadoTrasEvento("aprobado", "VOID_APPROVED")).toBe("anulado");
    expect(estadoTrasEvento("anulado", "SALE_APPROVED")).toBe("anulado");
  });
  it("una anulacion rechazada deja la venta aprobada", () => {
    expect(estadoTrasEvento("aprobado", "VOID_REJECTED")).toBe("aprobado");
    expect(estadoTrasEvento(null, "VOID_REJECTED")).toBe("aprobado");
  });
  it("un rechazo queda rechazado", () => {
    expect(estadoTrasEvento(null, "SALE_REJECTED")).toBe("rechazado");
  });
});

describe("filaDeAviso", () => {
  it("toma los datos de un pago por link", () => {
    const f = filaDeAviso({
      type: "SALE_APPROVED",
      subject: "ABC",
      data: {
        payment_id: "ABC",
        created_at: "2026-11-09T10:00:00-05:00",
        amount: { currency: "COP", total: 150000 },
        metadata: { reference: "LNK_123" },
        payer_email: "a@b.co",
        payment_method: "PSE",
        integration: "LINK",
      },
    });
    expect(f).toMatchObject({ payment_id: "ABC", monto: 150000, metodo: "PSE", referencia: "LNK_123", pagado_el: "2026-11-09T15:00:00.000Z" });
  });
  it("sin id no guarda nada", () => {
    expect(filaDeAviso({ type: "SALE_APPROVED", data: {} })).toBeNull();
  });
});

describe("productoDeReferencia", () => {
  const planes = new Map([["ord-1", "Plan Pro · Tienda X"]]);
  const cursos = new Map([["curso-1", "Curso: Ventas"]]);
  it("reconoce plan, curso, link y otro", () => {
    expect(productoDeReferencia("ord-1", planes, cursos).tipo).toBe("plan");
    expect(productoDeReferencia("curso-1", planes, cursos).tipo).toBe("curso");
    expect(productoDeReferencia("LNK_9", planes, cursos).tipo).toBe("link");
    expect(productoDeReferencia(null, planes, cursos).tipo).toBe("otro");
  });
});
