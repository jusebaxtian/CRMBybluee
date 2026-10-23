import { describe, it, expect, vi } from "vitest";

// Importar el sincronizador arrastra el cliente de la base; aqui solo se prueba lo puro.
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

import { cambiosDesdeGoogle, type FilaDeCita } from "@/lib/integraciones/google/sincronizar";
import type { EventoDeGoogle } from "@/lib/integraciones/google/calendario";

const cita: FilaDeCita = {
  id: "c1",
  titulo: "Demo del CRM",
  descripcion: null,
  inicio: "2026-10-22T20:00:00.000Z",
  fin: "2026-10-22T21:00:00.000Z",
  invitado_email: "cliente@correo.com",
  meet_url: "https://meet.google.com/abc-defg-hij",
  estado: "confirmado",
  updated_at: "2026-10-20T12:00:00.000Z",
  google_etag: null,
};

// El evento tal como esta en Google, igual a la cita, actualizado DESPUES que ella.
const igual = (extra: Partial<EventoDeGoogle> = {}): EventoDeGoogle => ({
  id: "g1",
  status: "confirmed",
  updated: "2026-10-20T13:00:00.000Z",
  summary: "Demo del CRM",
  start: { dateTime: "2026-10-22T15:00:00-05:00" },
  end: { dateTime: "2026-10-22T16:00:00-05:00" },
  attendees: [
    { email: "yo@gmail.com", organizer: true, self: true },
    { email: "Cliente@Correo.com" },
  ],
  hangoutLink: "https://meet.google.com/abc-defg-hij",
  ...extra,
});

describe("cambios que vienen de Google", () => {
  it("si es igual, no hay nada que cambiar (el eco de nuestros propios cambios)", () => {
    expect(cambiosDesdeGoogle(cita, igual())).toEqual({});
  });

  it("mover la cita en Google cambia la hora en el CRM", () => {
    const c = cambiosDesdeGoogle(cita, igual({ start: { dateTime: "2026-10-23T10:00:00-05:00" }, end: { dateTime: "2026-10-23T11:30:00-05:00" } }));
    expect(c.inicio).toBe("2026-10-23T15:00:00.000Z");
    expect(c.fin).toBe("2026-10-23T16:30:00.000Z");
    expect(c.titulo).toBeUndefined();
  });

  it("renombrar y cambiar el invitado", () => {
    const c = cambiosDesdeGoogle(cita, igual({ summary: "Demo nueva", attendees: [{ email: "yo@gmail.com", organizer: true, self: true }, { email: "otro@correo.com" }] }));
    expect(c.titulo).toBe("Demo nueva");
    expect(c.invitado_email).toBe("otro@correo.com");
  });

  it("quitar al invitado en Google lo quita en el CRM", () => {
    const c = cambiosDesdeGoogle(cita, igual({ attendees: [{ email: "yo@gmail.com", organizer: true, self: true }] }));
    expect(c.invitado_email).toBeNull();
  });

  it("cancelar en Google deja la cita cancelada, con el motivo", () => {
    expect(cambiosDesdeGoogle(cita, igual({ status: "cancelled" }))).toEqual({ estado: "cancelado", cancelado_desde: "google" });
  });

  it("una cita ya cancelada no se toca", () => {
    expect(cambiosDesdeGoogle({ ...cita, estado: "cancelado" }, igual({ summary: "Otra" }))).toEqual({});
  });

  it("gana el último cambio: si el CRM la editó después, lo de Google es lo viejo", () => {
    const reciente = { ...cita, updated_at: "2026-10-20T14:00:00.000Z" };
    expect(cambiosDesdeGoogle(reciente, igual({ summary: "Título viejo de Google" }))).toEqual({});
  });

  it("un evento pasado a todo el día no pierde su hora", () => {
    const c = cambiosDesdeGoogle(cita, igual({ start: { date: "2026-10-22" }, end: { date: "2026-10-23" } }));
    expect(c.inicio).toBeUndefined();
    expect(c.fin).toBeUndefined();
  });

  it("un título vacío en Google no borra el del CRM", () => {
    expect(cambiosDesdeGoogle(cita, igual({ summary: "   " })).titulo).toBeUndefined();
  });

  it("las notas de Google pasan al CRM", () => {
    expect(cambiosDesdeGoogle(cita, igual({ description: "Traer contrato" })).descripcion).toBe("Traer contrato");
  });
});

describe("varios invitados", () => {
  const conVarios: FilaDeCita = { ...cita, invitados: ["cliente@correo.com", "socio@correo.com"], invitado_email: "cliente@correo.com" };

  it("si Google tiene los mismos invitados, no hay nada que cambiar", () => {
    const g = igual({ attendees: [{ email: "yo@gmail.com", organizer: true, self: true }, { email: "cliente@correo.com" }, { email: "SOCIO@correo.com" }] });
    expect(cambiosDesdeGoogle(conVarios, g)).toEqual({});
  });

  it("agregar un invitado en Google lo agrega en el CRM", () => {
    const g = igual({ attendees: [{ email: "yo@gmail.com", organizer: true, self: true }, { email: "cliente@correo.com" }, { email: "socio@correo.com" }, { email: "nuevo@correo.com" }] });
    expect(cambiosDesdeGoogle(conVarios, g).invitados).toEqual(["cliente@correo.com", "socio@correo.com", "nuevo@correo.com"]);
  });

  it("quitar uno en Google lo quita en el CRM", () => {
    const g = igual({ attendees: [{ email: "yo@gmail.com", organizer: true, self: true }, { email: "cliente@correo.com" }] });
    const c = cambiosDesdeGoogle(conVarios, g);
    expect(c.invitados).toEqual(["cliente@correo.com"]);
    expect(c.invitado_email).toBe("cliente@correo.com");
  });

  it("el correo de la cuenta, que Google muestra como organizador, no se toma por un invitado quitado", () => {
    // La cita lleva el correo de la cuenta (yo@gmail.com) y el de un cliente.
    const cuenta: FilaDeCita = { ...cita, invitados: ["yo@gmail.com", "cliente@correo.com"], invitado_email: "yo@gmail.com" };
    const g = igual({ attendees: [{ email: "yo@gmail.com", organizer: true, self: true }, { email: "cliente@correo.com" }] });
    expect(cambiosDesdeGoogle(cuenta, g)).toEqual({});
  });
});
