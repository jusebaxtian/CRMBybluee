import { describe, expect, it } from "vitest";
import { remitenteDe } from "@/lib/inbox/remitente";

const nombres = new Map([["u1", "Laura Gómez"], ["u2", "Sebastián"]]);

describe("remitenteDe", () => {
  it("los entrantes no llevan nombre", () => expect(remitenteDe({ direction: "in", sent_by_user_id: "u1" }, nombres, null)).toBeNull());
  it("una persona del equipo, y (tú) si es quien mira", () => {
    expect(remitenteDe({ direction: "out", sent_by_user_id: "u1" }, nombres, "u2")?.texto).toBe("Laura Gómez");
    expect(remitenteDe({ direction: "out", sent_by_user_id: "u2" }, nombres, "u2")?.texto).toBe("Sebastián (tú)");
  });
  it("la IA, la app y las automatizaciones ganan sobre la sesion", () => {
    expect(remitenteDe({ direction: "out", origen: "ia", sent_by_user_id: "u1" }, nombres, null)?.clave).toBe("ia");
    expect(remitenteDe({ direction: "out", sent_from_app: true }, nombres, null)?.clave).toBe("app");
    expect(remitenteDe({ direction: "out", via_automation_id: "a1", sent_by_user_id: "u1" }, nombres, null)?.clave).toBe("automatizacion");
  });
  it("una persona que no es del espacio (modo soporte) sale como Soporte Bybluee", () => {
    expect(remitenteDe({ direction: "out", sent_by_user_id: "adm" }, nombres, "adm", new Set(["adm"]))?.clave).toBe("soporte");
    expect(remitenteDe({ direction: "out", sent_by_user_id: "u1" }, nombres, null, new Set(["adm"]))?.texto).toBe("Laura Gómez");
  });
  it("mensajes viejos sin datos no muestran nada", () => expect(remitenteDe({ direction: "out" }, nombres, null)).toBeNull());
});
