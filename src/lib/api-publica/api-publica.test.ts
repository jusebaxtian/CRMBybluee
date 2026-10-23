import { describe, it, expect, beforeEach } from "vitest";
import { generarLlave, huellaDe, llaveDeLaCabecera, PREFIJO_LLAVE } from "@/lib/api-publica/llaves";
import { consumir, limpiarInactivas, reiniciarLimites } from "@/lib/api-publica/limite";
import { esPermiso, permisosValidos } from "@/lib/api-publica/permisos";
import { telefonoValido, validarDatosContacto, contactoPublico } from "@/lib/api-publica/contactos";

describe("llaves", () => {
  it("genera llaves únicas con prefijo y huella que coincide", () => {
    const a = generarLlave();
    const b = generarLlave();
    expect(a.llave.startsWith(PREFIJO_LLAVE)).toBe(true);
    expect(a.llave).toHaveLength(PREFIJO_LLAVE.length + 40);
    expect(a.llave).not.toBe(b.llave);
    expect(a.huella).toBe(huellaDe(a.llave));
    expect(a.llave.startsWith(a.prefijo)).toBe(true);
    // La huella no contiene la llave.
    expect(a.huella).not.toContain(a.llave.slice(PREFIJO_LLAVE.length));
  });

  it("lee la llave de la cabecera Authorization", () => {
    const { llave } = generarLlave();
    expect(llaveDeLaCabecera(`Bearer ${llave}`)).toBe(llave);
    expect(llaveDeLaCabecera(`bearer ${llave}`)).toBe(llave);
    expect(llaveDeLaCabecera(llave)).toBeNull();
    expect(llaveDeLaCabecera("Bearer abc")).toBeNull();
    expect(llaveDeLaCabecera(null)).toBeNull();
  });
});

describe("límite por minuto", () => {
  beforeEach(() => reiniciarLimites());

  it("deja pasar hasta el tope y frena el siguiente", () => {
    for (let i = 0; i < 3; i++) expect(consumir("a", 3, 1000 + i).permitido).toBe(true);
    const cuarto = consumir("a", 3, 1010);
    expect(cuarto.permitido).toBe(false);
    expect(cuarto.reintentarEnSeg).toBeGreaterThan(0);
  });

  it("la ventana se desliza: pasado el minuto vuelve a dejar pasar", () => {
    for (let i = 0; i < 3; i++) consumir("a", 3, 1000);
    expect(consumir("a", 3, 30_000).permitido).toBe(false);
    expect(consumir("a", 3, 61_001).permitido).toBe(true);
  });

  it("cada clave cuenta aparte", () => {
    consumir("a", 1, 1000);
    expect(consumir("a", 1, 1001).permitido).toBe(false);
    expect(consumir("b", 1, 1001).permitido).toBe(true);
  });

  it("limpia las claves sin actividad", () => {
    consumir("a", 1, 1000);
    limpiarInactivas(100_000);
    expect(consumir("a", 1, 100_001).permitido).toBe(true);
  });
});

describe("permisos", () => {
  it("solo acepta los conocidos y sin repetir", () => {
    expect(esPermiso("contactos:leer")).toBe(true);
    expect(esPermiso("todo")).toBe(false);
    expect(permisosValidos(["contactos:leer", "contactos:leer", "x", 5])).toEqual(["contactos:leer"]);
    expect(permisosValidos("contactos:leer")).toEqual([]);
  });
});

describe("contactos", () => {
  it("normaliza el teléfono como el CRM", () => {
    expect(telefonoValido("300 123 4567")).toBe("573001234567");
    expect(telefonoValido("+57 300 123 4567")).toBe("573001234567");
    expect(telefonoValido("12")).toBeNull();
    expect(telefonoValido({})).toBeNull();
  });

  it("valida los campos editables y marca el nombre como manual", () => {
    const r = validarDatosContacto({ nombre: "  Ana  ", variable2: 15, notas: null });
    expect(r).toEqual({ columnas: { name: "Ana", variable2: "15", notes: null, name_source: "manual" } });
    expect(validarDatosContacto({ nombre: { x: 1 } })).toHaveProperty("motivo");
    expect(validarDatosContacto({ notas: "a".repeat(501) })).toHaveProperty("motivo");
    expect(validarDatosContacto({ nombre: "" })).toEqual({ columnas: { name: null, name_source: "whatsapp" } });
  });

  it("arma el contacto público con sus etiquetas", () => {
    const c = contactoPublico({
      id: "1",
      wa_id: "573001234567",
      name: "Ana",
      notes: null,
      variable2: null,
      variable3: null,
      variable4: null,
      marketing_opt_out_at: null,
      created_at: "2026-10-21T00:00:00Z",
      etiquetas: [{ tags: { name: "VIP" } }, { tags: [{ name: "Nuevo" }] }, { tags: null }],
    });
    expect(c.etiquetas).toEqual(["VIP", "Nuevo"]);
    expect(c.telefono).toBe("573001234567");
    expect(c.sin_marketing).toBe(false);
  });
});
