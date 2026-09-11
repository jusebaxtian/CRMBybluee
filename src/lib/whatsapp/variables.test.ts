import { describe, it, expect } from "vitest";
import {
  contactDisplayName,
  substituteContactVariables,
  buildTemplateSendParams,
} from "@/lib/whatsapp/variables";

// El "nombre" de un contacto es el del perfil de WhatsApp: la gente pone ahi
// emojis, simbolos o su propio numero. Estas pruebas fijan que solo se use
// cuando parece un nombre, porque el valor termina en un saludo que lee el
// cliente final.
describe("contactDisplayName — que se pone en el saludo", () => {
  it("usa el nombre cuando tiene letras", () => {
    expect(contactDisplayName({ name: "Julio Santana", wa_id: "573001112233" })).toBe("Julio Santana");
  });

  it("conserva acentos y ñ", () => {
    expect(contactDisplayName({ name: "Ñoño Ürrea", wa_id: "573001112233" })).toBe("Ñoño Ürrea");
  });

  it.each([
    ["emoji de mano", "✌🏻"],
    ["emoji de cara", "😀"],
    ["solo un punto", "."],
    ["solo simbolos", "•••"],
  ])("cae al generico si el nombre es %s", (_caso, nombre) => {
    expect(contactDisplayName({ name: nombre, wa_id: "573001112233" })).toBe("que tal");
  });

  it("cae al generico si el nombre es un numero", () => {
    expect(contactDisplayName({ name: "3215978316", wa_id: "573215978316" })).toBe("que tal");
  });

  it("cae al generico si no hay nombre, en vez de exponer el telefono", () => {
    expect(contactDisplayName({ name: null, wa_id: "573001112233" })).toBe("que tal");
    expect(contactDisplayName({ name: "", wa_id: "573001112233" })).toBe("que tal");
  });

  // Meta rechaza el envio completo si el parametro trae saltos de linea,
  // tabulaciones o rachas largas de espacios.
  it("aplana los espacios en blanco del nombre", () => {
    expect(contactDisplayName({ name: "  Reimo\nrestrepo  ", wa_id: "1" })).toBe("Reimo restrepo");
    expect(contactDisplayName({ name: "Ana\t\tLucia", wa_id: "1" })).toBe("Ana Lucia");
  });

  it("nunca devuelve vacio, porque Meta rechaza el parametro en blanco", () => {
    for (const nombre of [null, "", "   ", "\n", "😀", "123"]) {
      expect(contactDisplayName({ name: nombre, wa_id: "1" }).length).toBeGreaterThan(0);
    }
  });
});

describe("substituteContactVariables — texto libre", () => {
  const contacto = { name: "Julio", wa_id: "573001112233" };

  it("reemplaza {{nombre}}", () => {
    expect(substituteContactVariables("Hola {{nombre}} 👋", contacto)).toBe("Hola Julio 👋");
  });

  it("acepta {{1}} como alias", () => {
    expect(substituteContactVariables("Hola {{1}} 👋", contacto)).toBe("Hola Julio 👋");
  });

  it("no distingue mayusculas ni espacios dentro de las llaves", () => {
    expect(substituteContactVariables("{{Nombre}} y {{ nombre }}", contacto)).toBe("Julio y Julio");
  });

  it("reemplaza todas las apariciones", () => {
    expect(substituteContactVariables("{{nombre}}, {{nombre}}", contacto)).toBe("Julio, Julio");
  });

  it("deja el texto igual si no hay variables", () => {
    expect(substituteContactVariables("Sin variables", contacto)).toBe("Sin variables");
  });

  it("aplica el generico cuando el nombre no sirve", () => {
    expect(substituteContactVariables("Hola {{nombre}}", { name: "😀", wa_id: "1" })).toBe("Hola que tal");
  });
});

describe("buildTemplateSendParams — parametros para plantillas de Meta", () => {
  const contacto = { name: "Julio", wa_id: "573001112233" };

  it("envia el nombre cuando la plantilla declara una variable", () => {
    const { bodyParams } = buildTemplateSendParams({ variable_count: 1 }, contacto);
    expect(bodyParams).toEqual(["Julio"]);
  });

  it("no envia parametros si la plantilla no declara variables", () => {
    expect(buildTemplateSendParams({ variable_count: 0 }, contacto).bodyParams).toBeUndefined();
    expect(buildTemplateSendParams({ variable_count: null }, contacto).bodyParams).toBeUndefined();
    expect(buildTemplateSendParams({}, contacto).bodyParams).toBeUndefined();
  });

  it("rellena el {{1}} del boton de enlace cuando existe", () => {
    const { buttonUrlParam } = buildTemplateSendParams(
      {
        variable_count: 1,
        buttons: [
          { type: "QUICK_REPLY", text: "Si" },
          { type: "URL", text: "Ver", url: "https://x.co/{{1}}" },
        ],
      },
      contacto
    );
    expect(buttonUrlParam).toEqual({ index: 1, value: "Julio" });
  });

  it("no devuelve parametro de boton si ningun enlace lleva variable", () => {
    const { buttonUrlParam } = buildTemplateSendParams(
      { variable_count: 1, buttons: [{ type: "URL", text: "Ver", url: "https://x.co/fijo" }] },
      contacto
    );
    expect(buttonUrlParam).toBeUndefined();
  });
});
