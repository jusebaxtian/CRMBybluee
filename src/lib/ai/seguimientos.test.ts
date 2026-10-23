import { describe, it, expect } from "vitest";
import {
  clasificarPendientes,
  mensajeQueRepite,
  momentoDelPaso,
  parecidoDeTextos,
  rellenarPlantilla,
  tiempoLegible,
  toleranciaDeAtrasoMs,
  type ConversacionPendiente,
} from "@/lib/ai/seguimientos";

const PASOS = [
  { delay_minutes: 5, focus: "a" },
  { delay_minutes: 60, focus: "b" },
  { delay_minutes: 180, focus: "c" },
  { delay_minutes: 1440, focus: "d" },
];
const AHORA = new Date("2026-10-10T15:00:00Z").getTime();
const hace = (minutos: number) => new Date(AHORA - minutos * 60_000).toISOString();
const conv = (id: string, paso: number, inicioHaceMin: number): ConversacionPendiente => ({
  id,
  contact_id: `c-${id}`,
  whatsapp_account_id: null,
  ai_followup_count: paso,
  ai_followup_started_at: hace(inicioHaceMin),
});

describe("momentos y tolerancia", () => {
  it("cada paso se cuenta desde el inicio, no desde el paso anterior", () => {
    const inicio = "2026-10-10T10:00:00Z";
    expect(momentoDelPaso(inicio, 60)).toBe(new Date("2026-10-10T11:00:00Z").getTime());
    expect(momentoDelPaso(inicio, 180)).toBe(new Date("2026-10-10T13:00:00Z").getTime());
  });

  it("la tolerancia es la mitad de la espera, con piso de 30 minutos", () => {
    expect(toleranciaDeAtrasoMs(5)).toBe(30 * 60_000);
    expect(toleranciaDeAtrasoMs(60)).toBe(30 * 60_000);
    expect(toleranciaDeAtrasoMs(180)).toBe(90 * 60_000);
    expect(toleranciaDeAtrasoMs(1440)).toBe(720 * 60_000);
  });
});

describe("clasificarPendientes", () => {
  it("las que todavia no les toca se dejan esperando", () => {
    const r = clasificarPendientes([conv("a", 0, 3)], PASOS, AHORA);
    expect(r.tocan).toHaveLength(0);
    expect(r.vencidas).toHaveLength(0);
  });

  it("les toca cuando pasa el tiempo del paso", () => {
    const r = clasificarPendientes([conv("a", 0, 6)], PASOS, AHORA);
    expect(r.tocan.map((x) => x.conversacion.id)).toEqual(["a"]);
  });

  it("usa el paso que sigue segun cuantos seguimientos lleva", () => {
    // Lleva 2 enviados: ahora le toca el tercero (180 min). A los 100 min aun no.
    expect(clasificarPendientes([conv("a", 2, 100)], PASOS, AHORA).tocan).toHaveLength(0);
    expect(clasificarPendientes([conv("a", 2, 190)], PASOS, AHORA).tocan).toHaveLength(1);
  });

  it("la mas atrasada va primero, para que ninguna se quede esperando su turno", () => {
    const r = clasificarPendientes([conv("poco", 0, 10), conv("mucho", 0, 30), conv("medio", 0, 20)], PASOS, AHORA);
    expect(r.tocan.map((x) => x.conversacion.id)).toEqual(["mucho", "medio", "poco"]);
  });

  it("un seguimiento muy atrasado se descarta en vez de mandarse tarde", () => {
    // Paso de 5 min con 3 dias de atraso: ya no es un recordatorio.
    const r = clasificarPendientes([conv("viejo", 0, 3 * 24 * 60)], PASOS, AHORA);
    expect(r.tocan).toHaveLength(0);
    expect(r.vencidas.map((x) => x.conversacion.id)).toEqual(["viejo"]);
  });

  it("un atraso dentro de la tolerancia todavia se envia", () => {
    // Paso de 5 min a los 25 min de iniciar: 20 min de atraso (< 30).
    expect(clasificarPendientes([conv("a", 0, 25)], PASOS, AHORA).tocan).toHaveLength(1);
    // A los 40 min: 35 min de atraso (> 30): se descarta.
    expect(clasificarPendientes([conv("a", 0, 40)], PASOS, AHORA).vencidas).toHaveLength(1);
  });

  it("el ultimo paso (24 h) tolera 12 horas de atraso", () => {
    expect(clasificarPendientes([conv("a", 3, 1440 + 600)], PASOS, AHORA).tocan).toHaveLength(1);
    expect(clasificarPendientes([conv("a", 3, 1440 + 800)], PASOS, AHORA).vencidas).toHaveLength(1);
  });

  it("sin paso siguiente (secuencia terminada) o sin inicio no hace nada", () => {
    expect(clasificarPendientes([conv("a", 4, 5000)], PASOS, AHORA).tocan).toHaveLength(0);
    expect(clasificarPendientes([{ ...conv("b", 0, 10), ai_followup_started_at: null }], PASOS, AHORA).tocan).toHaveLength(0);
  });

  it("con mas de 25 pendientes, a las del fondo tambien les llega el turno (el fallo de Fundetec)", () => {
    // 40 conversaciones: 30 esperando el paso de 24 h (no les toca) y 10 con el paso de 5 min vencido.
    const esperando = Array.from({ length: 30 }, (_, i) => conv(`e${i}`, 3, 60));
    const debidas = Array.from({ length: 10 }, (_, i) => conv(`d${i}`, 0, 8 + i));
    const r = clasificarPendientes([...esperando, ...debidas], PASOS, AHORA);
    expect(r.tocan).toHaveLength(10);
    expect(r.tocan.every((x) => x.conversacion.id.startsWith("d"))).toBe(true);
  });
});

describe("que no diga lo mismo", () => {
  const primero =
    "Recuerda que tu primer módulo es completamente gratis, ¡puedes empezar hoy mismo sin pagar nada! Si tienes alguna duda para arrancar, aquí estoy para ayudarte.";

  it("un mensaje casi igual cuenta como repeticion", () => {
    const casiIgual =
      "Hola, recuerda que tu primer módulo es completamente gratis, puedes empezar hoy mismo sin pagar nada. Si tienes dudas para arrancar, aquí estoy.";
    expect(parecidoDeTextos(primero, casiIgual)).toBeGreaterThan(0.55);
    expect(mensajeQueRepite(casiIgual, [primero])).toBe(primero);
  });

  it("un mensaje distinto, aunque hable del mismo negocio, no cuenta", () => {
    const otro =
      "Te cuento que somos FUNDETEC, una institución educativa legal que ya graduó a muchas personas. Puedes verificarlo en nuestro Instagram.";
    expect(parecidoDeTextos(primero, otro)).toBeLessThan(0.3);
    expect(mensajeQueRepite(otro, [primero])).toBeNull();
  });

  it("ignora tildes, mayusculas y signos", () => {
    expect(parecidoDeTextos("¡Hola! ¿Cómo ESTÁS hoy?", "hola como estas")).toBe(1);
  });

  it("textos vacios no dan falsos positivos", () => {
    expect(parecidoDeTextos("", "hola")).toBe(0);
    expect(mensajeQueRepite("", [""])).toBeNull();
  });

  it("devuelve el mas parecido de varios", () => {
    const a = "El primer módulo es gratis, empieza hoy mismo sin pagar nada";
    expect(mensajeQueRepite("El primer módulo es gratis, empieza hoy mismo sin pagar nada y ya", ["Otra cosa totalmente distinta aquí", a])).toBe(a);
  });
});

describe("tiempoLegible", () => {
  it("minutos, horas y dias", () => {
    expect(tiempoLegible(1)).toBe("1 minuto");
    expect(tiempoLegible(45)).toBe("45 minutos");
    expect(tiempoLegible(60)).toBe("1 hora");
    expect(tiempoLegible(180)).toBe("3 horas");
    expect(tiempoLegible(1440)).toBe("1 día");
    expect(tiempoLegible(3000)).toBe("2 días");
  });
});

describe("rellenarPlantilla", () => {
  it("pone el nombre donde iba la variable", () => {
    expect(rellenarPlantilla("Hola {{1}}, tu proceso sigue abierto.", ["Marcela"])).toBe("Hola Marcela, tu proceso sigue abierto.");
  });
  it("varias variables y repetidas", () => {
    expect(rellenarPlantilla("{{1}} te escribe: {{2}}. Adiós {{1}}", ["Ana", "hola"])).toBe("Ana te escribe: hola. Adiós Ana");
  });
  it("una variable sin valor queda vacia, no como llaves", () => {
    expect(rellenarPlantilla("Hola {{1}} y {{2}}", ["Ana"])).toBe("Hola Ana y ");
    expect(rellenarPlantilla("Hola {{1}}", undefined)).toBe("Hola ");
  });
  it("sin variables o sin cuerpo no cambia nada", () => {
    expect(rellenarPlantilla("Hola a todos", [])).toBe("Hola a todos");
    expect(rellenarPlantilla(null, ["x"])).toBeNull();
  });
});
