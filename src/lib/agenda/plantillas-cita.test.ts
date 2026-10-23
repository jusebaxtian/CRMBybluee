import { describe, it, expect } from "vitest";
import { PLANTILLAS_CITA, codigoDeMeet, elegirPlantillaGuardada, limpiarParametro, nombreBloqueadoPorBorrado, nombresDePlantilla, parametrosDeCita, plantillaDeCita } from "@/lib/agenda/plantillas-cita";
import { ErrorDeMeta } from "@/lib/whatsapp/graph";
import { cuantasVariables } from "@/lib/contactos/variables";

describe("plantillas de confirmación de cita", () => {
  it("son dos: con botón de Meet y sin él", () => {
    expect(PLANTILLAS_CITA.map((p) => p.name).sort()).toEqual(["confirmacion_cita", "confirmacion_cita_meet"]);
    expect(plantillaDeCita(true).boton?.url).toBe("https://meet.google.com/{{1}}");
    expect(plantillaDeCita(false).boton).toBeNull();
  });

  it("cada cuerpo declara tantas variables como ejemplos lleva, sin huecos", () => {
    for (const p of PLANTILLAS_CITA) {
      expect(cuantasVariables(p.body)).toBe(p.ejemplos.length);
      for (let i = 1; i <= p.ejemplos.length; i++) expect(p.body).toContain(`{{${i}}}`);
    }
  });

  it("no empiezan ni terminan con una variable y caben en el límite de WhatsApp", () => {
    for (const p of PLANTILLAS_CITA) {
      expect(p.body.trimEnd().endsWith("}}")).toBe(false);
      expect(p.body.trimStart().startsWith("{{")).toBe(false);
      expect(p.body.length).toBeLessThanOrEqual(1024);
    }
  });

  it("no anuncian a Bybluee: el nombre de la empresa es una variable", () => {
    for (const p of PLANTILLAS_CITA) expect(p.body.toLowerCase()).not.toContain("bybluee");
  });

  it("los nombres solo usan minúsculas, números y guion bajo", () => {
    for (const p of PLANTILLAS_CITA) expect(p.name).toMatch(/^[a-z0-9_]+$/);
  });
});

describe("el código de Meet que llena el botón", () => {
  it("lo saca del link", () => {
    expect(codigoDeMeet("https://meet.google.com/abc-defg-hij")).toBe("abc-defg-hij");
    expect(codigoDeMeet("https://meet.google.com/abc-defg-hij?authuser=0")).toBe("abc-defg-hij");
  });
  it("rechaza lo que no es un link de Meet", () => {
    expect(codigoDeMeet(null)).toBeNull();
    expect(codigoDeMeet("https://zoom.us/j/123")).toBeNull();
    expect(codigoDeMeet("https://meet.google.com/lookup/xyz")).toBeNull();
  });
});

describe("parámetros del mensaje", () => {
  it("quita saltos de línea y espacios de más (WhatsApp los rechaza)", () => {
    expect(limpiarParametro("Demo\ndel   CRM\t hoy")).toBe("Demo del CRM hoy");
  });

  it("nunca manda un parámetro vacío", () => {
    expect(limpiarParametro("   ")).toBe("-");
  });

  it("arma los cuatro valores en orden, con el nombre de la empresa del cliente", () => {
    const p = parametrosDeCita({ contacto: "Marcela", empresa: "Distribuciones Andina", titulo: "Demo", inicioIso: "2026-10-22T20:00:00.000Z" });
    expect(p).toHaveLength(4);
    expect(p.slice(0, 3)).toEqual(["Marcela", "Distribuciones Andina", "Demo"]);
    expect(p[3]).toMatch(/3:00/);
  });

  it("sin nombre de contacto saluda como 'cliente'", () => {
    expect(parametrosDeCita({ contacto: null, empresa: "X", titulo: "Y", inicioIso: "2026-10-22T20:00:00.000Z" })[0]).toBe("cliente");
  });
});

describe("nombres de reemplazo (Meta bloquea 4 semanas un nombre borrado)", () => {
  const sinMeet = plantillaDeCita(false);

  it("cada plantilla tiene un reemplazo con nombre válido y distinto", () => {
    for (const p of PLANTILLAS_CITA) {
      const nombres = nombresDePlantilla(p);
      expect(nombres.length).toBeGreaterThan(1);
      expect(new Set(nombres).size).toBe(nombres.length);
      for (const n of nombres) expect(n).toMatch(/^[a-z0-9_]+$/);
    }
    expect(nombresDePlantilla(sinMeet)).toEqual(["confirmacion_cita", "confirmacion_cita_v2"]);
  });

  it("usa la aprobada: el reemplazo si el original no existe o no está aprobado", () => {
    const v2 = { meta_template_name: "confirmacion_cita_v2", status: "APPROVED" };
    const original = { meta_template_name: "confirmacion_cita", status: "APPROVED" };
    expect(elegirPlantillaGuardada([v2], sinMeet)).toBe(v2);
    expect(elegirPlantillaGuardada([v2, original], sinMeet)).toBe(original);
    expect(elegirPlantillaGuardada([{ ...original, status: "PENDING" }, v2], sinMeet)).toBe(v2);
  });

  it("si ninguna está aprobada devuelve la primera que exista; sin ninguna, null", () => {
    const pendiente = { meta_template_name: "confirmacion_cita_v2", status: "PENDING" };
    expect(elegirPlantillaGuardada([pendiente], sinMeet)).toBe(pendiente);
    expect(elegirPlantillaGuardada([], sinMeet)).toBeNull();
  });

  it("reconoce el bloqueo de Meta por borrado reciente", () => {
    expect(nombreBloqueadoPorBorrado(new ErrorDeMeta("x", 100, 2388023))).toBe(true);
    expect(nombreBloqueadoPorBorrado(new Error("Se está eliminando el idioma de la plantilla"))).toBe(true);
    expect(nombreBloqueadoPorBorrado(new ErrorDeMeta("otra cosa", 100, 1))).toBe(false);
  });
});
