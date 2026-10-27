import { afterEach, describe, expect, it } from "vitest";
import {
  DIAS_DE_HISTORIAL,
  contenidoDeLaApp,
  coexistenciaPermitidaPara,
  textoDeSincronizacion,
  dentroDeLosUltimosDias,
  direccionDelHistorial,
  estadoDelHistorial,
} from "./coexistencia";

const AHORA = Date.UTC(2026, 9, 27, 12, 0, 0);
const hace = (dias: number) => Math.floor((AHORA - dias * 86_400_000) / 1000);

describe("dentroDeLosUltimosDias", () => {
  it("acepta lo de los ultimos 30 dias y rechaza lo anterior", () => {
    expect(DIAS_DE_HISTORIAL).toBe(30);
    expect(dentroDeLosUltimosDias(hace(1), AHORA)).toBe(true);
    expect(dentroDeLosUltimosDias(String(hace(29)), AHORA)).toBe(true);
    expect(dentroDeLosUltimosDias(hace(31), AHORA)).toBe(false);
    expect(dentroDeLosUltimosDias(hace(150), AHORA)).toBe(false);
  });
  it("rechaza marcas invalidas", () => {
    expect(dentroDeLosUltimosDias("no-es-un-numero", AHORA)).toBe(false);
  });
});

describe("direccionDelHistorial", () => {
  it("es saliente cuando lo envio el numero del negocio, sin importar el formato", () => {
    expect(direccionDelHistorial("573001112233", "+57 300 111 2233")).toBe("out");
    expect(direccionDelHistorial("573154445566", "+57 300 111 2233")).toBe("in");
    expect(direccionDelHistorial(undefined, "+57 300 111 2233")).toBe("in");
  });
});

describe("estadoDelHistorial", () => {
  it("traduce los estados de Meta", () => {
    expect(estadoDelHistorial("READ")).toBe("read");
    expect(estadoDelHistorial("PLAYED")).toBe("read");
    expect(estadoDelHistorial("DELIVERED")).toBe("delivered");
    expect(estadoDelHistorial("ERROR")).toBe("failed");
    expect(estadoDelHistorial("SENT")).toBe("sent");
    expect(estadoDelHistorial("PENDING")).toBe("sent");
    expect(estadoDelHistorial(undefined)).toBe("sent");
  });
});

describe("contenidoDeLaApp", () => {
  const base = { id: "wamid.X", timestamp: "1" };
  it("texto", () => {
    expect(contenidoDeLaApp({ ...base, type: "text", text: { body: "Hola" } })).toMatchObject({ tipo: "text", texto: "Hola" });
  });
  it("imagen con pie y su id de archivo", () => {
    expect(contenidoDeLaApp({ ...base, type: "image", image: { id: "m1", mime_type: "image/jpeg", caption: "Mira" } })).toEqual({
      tipo: "image",
      texto: "Mira",
      mediaId: "m1",
      mimeType: "image/jpeg",
    });
  });
  it("documento usa el nombre del archivo", () => {
    expect(contenidoDeLaApp({ ...base, type: "document", document: { id: "d1", filename: "lista.pdf" } }).texto).toBe("lista.pdf");
  });
  it("marcador de archivo del historial y tipos desconocidos no dejan huecos", () => {
    expect(contenidoDeLaApp({ ...base, type: "media_placeholder" }).texto).toContain("Archivo del historial");
    expect(contenidoDeLaApp({ ...base, type: "location" }).texto).toContain("location");
  });
});

describe("textoDeSincronizacion", () => {
  it("resume el avance", () => {
    expect(textoDeSincronizacion(null)).toBeNull();
    expect(textoDeSincronizacion({ contactos: { estado: "listo" }, historial: { estado: "en_curso", progreso: 40.4 } })).toBe(
      "Contactos listos · Historial 40%"
    );
    expect(textoDeSincronizacion({ contactos: { estado: "listo" }, historial: { estado: "listo", progreso: 100 } })).toBe(
      "Contactos listos · Historial listo"
    );
    expect(textoDeSincronizacion({ contactos: { estado: "pendiente" }, historial: { estado: "rechazado" } })).toBe(
      "Contactos pendientes · Historial no compartido"
    );
  });
});

describe("coexistenciaPermitidaPara", () => {
  afterEach(() => {
    delete process.env.COEXISTENCIA_ESPACIOS;
  });
  it("sin variable es para todos", () => {
    expect(coexistenciaPermitidaPara("cualquiera")).toBe(true);
  });
  it("con lista, solo esos espacios", () => {
    process.env.COEXISTENCIA_ESPACIOS = "a, b";
    expect(coexistenciaPermitidaPara("a")).toBe(true);
    expect(coexistenciaPermitidaPara("c")).toBe(false);
    expect(coexistenciaPermitidaPara(null)).toBe(false);
  });
});
