import { describe, it, expect } from "vitest";
import { textoDeConfirmacion } from "@/lib/agenda/mensaje-cita";

describe("texto de confirmación de la cita (ventana abierta)", () => {
  const base = { titulo: "Demostración del CRM", inicioIso: "2026-10-23T20:00:00.000Z" };

  it("saluda por el nombre, dice la cita, la hora de Colombia y el link de Meet", () => {
    const t = textoDeConfirmacion({ ...base, nombre: "Marcela", meetUrl: "https://meet.google.com/abc-defg-hij" });
    expect(t.split("\n")).toHaveLength(3);
    expect(t).toContain("Hola Marcela, te confirmo nuestra cita: *Demostración del CRM*.");
    expect(t).toContain("(hora de Colombia)");
    expect(t).toContain("3:00");
    expect(t).toContain("💻 Reunión por Meet: https://meet.google.com/abc-defg-hij");
  });

  it("sin Meet no lleva la línea de la reunión", () => {
    const t = textoDeConfirmacion({ ...base, nombre: "Marcela", meetUrl: null });
    expect(t).not.toContain("Meet");
    expect(t.split("\n")).toHaveLength(2);
  });

  it("sin nombre saluda sin nombre", () => {
    expect(textoDeConfirmacion({ ...base, nombre: "  " }).startsWith("Hola, te confirmo")).toBe(true);
  });
});
