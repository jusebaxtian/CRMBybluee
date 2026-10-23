import { describe, it, expect } from "vitest";
import { bogotaAIso, correoValido, isoABogotaLocal, sumarMinutos } from "@/lib/agenda/tiempo";
import { choquesCon, cuerpoDeEvento, cuerpoDeRecordatorio } from "@/lib/integraciones/google/calendario";

describe("horas de Bogotá", () => {
  it("3 pm de Bogotá son las 20:00 UTC, sea cual sea la zona del navegador", () => {
    expect(bogotaAIso("2026-10-20T15:00")).toBe("2026-10-20T20:00:00.000Z");
  });

  it("pasa de ida y vuelta sin cambiar la hora", () => {
    const iso = bogotaAIso("2026-12-31T23:30")!;
    expect(iso).toBe("2027-01-01T04:30:00.000Z");
    expect(isoABogotaLocal(iso)).toBe("2026-12-31T23:30");
  });

  it("rechaza lo que no es una fecha y hora", () => {
    expect(bogotaAIso("")).toBeNull();
    expect(bogotaAIso("2026-10-20")).toBeNull();
    expect(bogotaAIso("2026-13-45T10:00")).toBeNull();
  });

  it("suma la duración", () => {
    expect(sumarMinutos("2026-10-20T20:00:00.000Z", 60)).toBe("2026-10-20T21:00:00.000Z");
    expect(sumarMinutos("2026-10-20T20:00:00.000Z", 90)).toBe("2026-10-20T21:30:00.000Z");
  });
});

describe("correo del invitado", () => {
  it("acepta correos normales y rechaza basura", () => {
    expect(correoValido("cliente@correo.com")).toBe(true);
    expect(correoValido("a@b")).toBe(false);
    expect(correoValido("sin arroba.com")).toBe(false);
    expect(correoValido("")).toBe(false);
  });
});

type Cuerpo = {
  summary: string;
  start: { dateTime: string; timeZone: string };
  attendees?: { email: string }[];
  extendedProperties: { private: { crmEventoId: string } };
  conferenceData?: { createRequest: Record<string, unknown> };
};

describe("cuerpo del evento para Google", () => {
  const base = {
    crmEventoId: "ev-1",
    titulo: "Demo del CRM",
    inicioIso: "2026-10-20T20:00:00.000Z",
    finIso: "2026-10-20T21:00:00.000Z",
    conMeet: true,
    invitadoEmail: "cliente@correo.com",
  };

  it("lleva la hora en Bogotá, el invitado y la marca del CRM", () => {
    const c = cuerpoDeEvento(base, "req-1") as unknown as Cuerpo;
    expect(c.summary).toBe("Demo del CRM");
    expect(c.start).toEqual({ dateTime: base.inicioIso, timeZone: "America/Bogota" });
    expect(c.attendees).toEqual([{ email: "cliente@correo.com" }]);
    expect(c.extendedProperties.private.crmEventoId).toBe("ev-1");
  });

  it("pide la reunión de Meet solo si se marcó", () => {
    const con = cuerpoDeEvento(base, "req-1") as unknown as Cuerpo;
    expect(con.conferenceData?.createRequest).toMatchObject({ requestId: "req-1", conferenceSolutionKey: { type: "hangoutsMeet" } });
    const sin = cuerpoDeEvento({ ...base, conMeet: false }, "req-1") as unknown as Cuerpo;
    expect(sin.conferenceData).toBeUndefined();
  });

  it("sin correo no manda invitados", () => {
    const c = cuerpoDeEvento({ ...base, invitadoEmail: null }, "req-1") as unknown as Cuerpo;
    expect(c.attendees).toBeUndefined();
  });
});

describe("choques con lo que ya tiene ocupado", () => {
  const ocupados = [
    { start: "2026-10-20T20:00:00Z", end: "2026-10-20T21:00:00Z" },
    { start: "2026-10-20T23:00:00Z", end: "2026-10-21T00:00:00Z" },
  ];

  it("detecta un cruce, aunque sea parcial", () => {
    expect(choquesCon(ocupados, "2026-10-20T20:30:00Z", "2026-10-20T21:30:00Z")).toHaveLength(1);
    expect(choquesCon(ocupados, "2026-10-20T19:00:00Z", "2026-10-20T20:15:00Z")).toHaveLength(1);
  });

  it("una cita que empieza justo cuando termina otra no choca", () => {
    expect(choquesCon(ocupados, "2026-10-20T21:00:00Z", "2026-10-20T22:00:00Z")).toHaveLength(0);
  });

  it("sin cruces, no avisa", () => {
    expect(choquesCon(ocupados, "2026-10-20T21:00:00Z", "2026-10-20T22:59:00Z")).toHaveLength(0);
    expect(choquesCon([], "2026-10-20T20:00:00Z", "2026-10-20T21:00:00Z")).toHaveLength(0);
  });
});

describe("alarmas en Google", () => {
  it("las citas avisan 30 y 10 minutos antes", () => {
    const c = cuerpoDeEvento(
      { crmEventoId: "e", titulo: "T", inicioIso: "2026-10-22T20:00:00.000Z", finIso: "2026-10-22T21:00:00.000Z", conMeet: false },
      "r"
    ) as unknown as { reminders: { useDefault: boolean; overrides: { minutes: number }[] } };
    expect(c.reminders.useDefault).toBe(false);
    expect(c.reminders.overrides.map((o) => o.minutes)).toEqual([30, 10]);
  });

  it("el recordatorio dura 15 minutos, suena al llegar la hora y no cuenta como ocupado", () => {
    const c = cuerpoDeRecordatorio({ crmRecordatorioId: "r1", texto: "Llamar cliente", descripcion: "Contacto: Ana", inicioIso: "2026-10-22T20:00:00.000Z" }) as unknown as {
      summary: string;
      end: { dateTime: string };
      transparency: string;
      reminders: { overrides: { minutes: number }[] };
      extendedProperties: { private: { crmRecordatorioId: string } };
    };
    expect(c.summary).toBe("Recordatorio: Llamar cliente");
    expect(c.end.dateTime).toBe("2026-10-22T20:15:00.000Z");
    expect(c.transparency).toBe("transparent");
    expect(c.reminders.overrides.map((o) => o.minutes)).toEqual([0, 10]);
    expect(c.extendedProperties.private.crmRecordatorioId).toBe("r1");
  });
});

describe("varios invitados hacia Google", () => {
  it("todos los correos van como invitados", () => {
    const c = cuerpoDeEvento(
      { crmEventoId: "e", titulo: "T", inicioIso: "2026-10-22T20:00:00.000Z", finIso: "2026-10-22T21:00:00.000Z", conMeet: true, invitadosEmails: ["a@x.com", "b@y.com"] },
      "r"
    ) as unknown as { attendees: { email: string }[] };
    expect(c.attendees).toEqual([{ email: "a@x.com" }, { email: "b@y.com" }]);
  });

  it("sin invitados no manda la lista (la reunión de Meet se crea igual)", () => {
    const c = cuerpoDeEvento(
      { crmEventoId: "e", titulo: "T", inicioIso: "2026-10-22T20:00:00.000Z", finIso: "2026-10-22T21:00:00.000Z", conMeet: true, invitadosEmails: [] },
      "r"
    ) as unknown as { attendees?: unknown; conferenceData?: unknown };
    expect(c.attendees).toBeUndefined();
    expect(c.conferenceData).toBeDefined();
  });
});
