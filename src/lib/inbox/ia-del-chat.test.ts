import { describe, expect, it } from "vitest";
import { iaDelChat } from "@/lib/inbox/ia-del-chat";

const juanes = {
  nombre: "Juanes",
  activo: true,
  numeros_prueba: [],
  lineas_modo: "seleccionadas",
  lineas_ids: ["VENTAS"],
  asesores_modo: "seleccionados",
  asesores_ids: ["JUANSE"],
};
const base = {
  vendedor: juanes,
  agentes: [
    { agent_name: "Bot Soporte", is_active: false, whatsapp_account_id: "SOPORTE" },
    { agent_name: "Bot Ventas", is_active: false, whatsapp_account_id: "VENTAS" },
  ],
  lineaId: "VENTAS",
  asignadoA: "JUANSE",
  waId: "573001112233",
  atencionHumana: false,
  contactoExcluido: false,
  espacioPausado: false,
};

describe("iaDelChat (marca IA de la bandeja)", () => {
  it("chat de Juanse en Ventas: lo atiende Juanes", () => expect(iaDelChat(base)).toBe("Juanes"));
  it("chat de otro asesor y agente de la linea apagado: sin IA", () => expect(iaDelChat({ ...base, asignadoA: "SANTIAGO" })).toBeNull());
  it("fuera de Juanes con el agente de la linea encendido: ese agente", () =>
    expect(
      iaDelChat({ ...base, lineaId: "SOPORTE", agentes: [{ agent_name: "Bot Soporte", is_active: true, whatsapp_account_id: "SOPORTE" }] })
    ).toBe("Bot Soporte"));
  it("sin agente de la linea usa el general del espacio", () =>
    expect(iaDelChat({ ...base, vendedor: null, agentes: [{ agent_name: "General", is_active: true, whatsapp_account_id: null }] })).toBe("General"));
  it("atencion humana, contacto excluido o cuenta pausada: sin IA", () => {
    expect(iaDelChat({ ...base, atencionHumana: true })).toBeNull();
    expect(iaDelChat({ ...base, contactoExcluido: true })).toBeNull();
    expect(iaDelChat({ ...base, espacioPausado: true })).toBeNull();
  });
  it("Juanes apagado y sin agentes encendidos: sin IA", () => expect(iaDelChat({ ...base, vendedor: { ...juanes, activo: false } })).toBeNull());
});
