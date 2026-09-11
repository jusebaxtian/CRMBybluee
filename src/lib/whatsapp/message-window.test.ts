import { describe, it, expect } from "vitest";
import {
  MESSAGE_WINDOW_MS,
  EXPIRING_SOON_MAX_MS,
  EXPIRING_SOON_MIN_MS,
  windowExpiresAt,
  msRemainingInWindow,
  isWindowOpen,
  isWindowExpiringSoon,
} from "@/lib/whatsapp/message-window";

// Regla de Meta: solo se puede enviar texto libre dentro de las 24 horas
// siguientes al ultimo mensaje del contacto. Fuera de ahi, Meta rechaza con
// el error 131047 y hay que usar plantilla. De esta logica dependen el
// compositor del chat, el filtro "por vencer" de la bandeja, la audiencia de
// campañas y los seguimientos de la IA.
const AHORA = new Date("2026-09-11T12:00:00Z").getTime();
const haceHoras = (h: number) => new Date(AHORA - h * 60 * 60 * 1000).toISOString();

describe("isWindowOpen — si se puede escribir texto libre", () => {
  it("abierta si el contacto escribio hace un rato", () => {
    expect(isWindowOpen(haceHoras(1), AHORA)).toBe(true);
    expect(isWindowOpen(haceHoras(23), AHORA)).toBe(true);
  });

  it("cerrada pasadas las 24 horas", () => {
    expect(isWindowOpen(haceHoras(24.1), AHORA)).toBe(false);
    expect(isWindowOpen(haceHoras(48), AHORA)).toBe(false);
  });

  it("cerrada si el contacto nunca ha escrito", () => {
    expect(isWindowOpen(null, AHORA)).toBe(false);
  });

  it("el corte cae exactamente en las 24 horas", () => {
    const justoAntes = new Date(AHORA - MESSAGE_WINDOW_MS + 1000).toISOString();
    const justoDespues = new Date(AHORA - MESSAGE_WINDOW_MS - 1000).toISOString();
    expect(isWindowOpen(justoAntes, AHORA)).toBe(true);
    expect(isWindowOpen(justoDespues, AHORA)).toBe(false);
  });
});

describe("msRemainingInWindow — cuanto falta", () => {
  it("devuelve el tiempo restante", () => {
    expect(msRemainingInWindow(haceHoras(23), AHORA)).toBe(60 * 60 * 1000);
  });

  it("es negativo cuando ya cerro", () => {
    expect(msRemainingInWindow(haceHoras(25), AHORA)).toBeLessThan(0);
  });

  it("es 0 cuando no hay ventana que contar", () => {
    expect(msRemainingInWindow(null, AHORA)).toBe(0);
  });
});

describe("windowExpiresAt — cuando cierra", () => {
  it("son 24 horas exactas despues del ultimo entrante", () => {
    const entrante = haceHoras(2);
    const cierre = windowExpiresAt(entrante)!;
    expect(cierre.getTime() - new Date(entrante).getTime()).toBe(MESSAGE_WINDOW_MS);
  });

  it("null si el contacto nunca escribio", () => {
    expect(windowExpiresAt(null)).toBeNull();
  });
});

describe("isWindowExpiringSoon — el aviso de la bandeja", () => {
  it("avisa dentro de las ultimas dos horas", () => {
    expect(isWindowExpiringSoon(haceHoras(23), AHORA)).toBe(true); // falta 1h
  });

  it("no avisa cuando todavia sobra tiempo", () => {
    expect(isWindowExpiringSoon(haceHoras(10), AHORA)).toBe(false); // faltan 14h
  });

  it("no avisa cuando faltan segundos: el aviso solo alcanzaria a parpadear", () => {
    const casiCerrada = new Date(AHORA - MESSAGE_WINDOW_MS + 5000).toISOString();
    expect(isWindowExpiringSoon(casiCerrada, AHORA)).toBe(false);
  });

  it("no avisa si ya cerro", () => {
    expect(isWindowExpiringSoon(haceHoras(25), AHORA)).toBe(false);
  });

  it("no avisa si el contacto nunca escribio", () => {
    expect(isWindowExpiringSoon(null, AHORA)).toBe(false);
  });

  it("respeta ambos bordes del rango de aviso", () => {
    const enElBordeAlto = new Date(AHORA - MESSAGE_WINDOW_MS + EXPIRING_SOON_MAX_MS).toISOString();
    const enElBordeBajo = new Date(AHORA - MESSAGE_WINDOW_MS + EXPIRING_SOON_MIN_MS).toISOString();
    expect(isWindowExpiringSoon(enElBordeAlto, AHORA)).toBe(true);
    expect(isWindowExpiringSoon(enElBordeBajo, AHORA)).toBe(true);
  });
});

describe("coherencia entre las funciones", () => {
  it("si esta por vencer, entonces esta abierta", () => {
    for (const h of [22, 22.5, 23, 23.5, 23.9]) {
      if (isWindowExpiringSoon(haceHoras(h), AHORA)) {
        expect(isWindowOpen(haceHoras(h), AHORA)).toBe(true);
      }
    }
  });

  it("abierta equivale a tiempo restante positivo", () => {
    for (const h of [0, 1, 12, 23, 24, 25, 48]) {
      const entrante = haceHoras(h);
      expect(isWindowOpen(entrante, AHORA)).toBe(msRemainingInWindow(entrante, AHORA) > 0);
    }
  });
});
