import { describe, it, expect } from "vitest";
import { buildTemplateSendParams } from "@/lib/whatsapp/variables";
import {
  ajustarVariables,
  cuantasVariables,
  normalizarValor,
  normalizarVariables,
  valorDeContacto,
  variablesSaltadas,
} from "@/lib/contactos/variables";

/**
 * El caso real que pidió esto: "Hola {{1}}, tienes una cita para el {{2}} a
 * las {{3}}". Antes las tres variables se llenaban con el nombre y el envío
 * fallaba entero.
 */
const contacto = {
  name: "Felipe",
  wa_id: "573001112233",
  variable2: "23 de octubre",
  variable3: "8:00 p. m.",
  variable4: null,
};

describe("emparejar variables con datos del contacto", () => {
  it("manda cada variable con su dato, en orden", () => {
    const r = buildTemplateSendParams(
      {
        variable_count: 3,
        variables_origen: [{ origen: "nombre" }, { origen: "variable2" }, { origen: "variable3" }],
      },
      contacto
    );
    expect(r.bodyParams).toEqual(["Felipe", "23 de octubre", "8:00 p. m."]);
    expect(r.faltan).toEqual([]);
  });

  it("avisa qué dato le falta al contacto en vez de mandar el mensaje a medias", () => {
    const r = buildTemplateSendParams(
      { variable_count: 2, variables_origen: [{ origen: "nombre" }, { origen: "variable4" }] },
      contacto
    );
    expect(r.faltan).toEqual(["variable4"]);
  });

  it("las plantillas viejas siguen funcionando igual que siempre", () => {
    // Sin emparejamiento guardado: una sola variable con el nombre, que es lo
    // que hacía antes. Cambiarlo habría roto envíos que hoy funcionan.
    const r = buildTemplateSendParams({ variable_count: 1, variables_origen: null }, contacto);
    expect(r.bodyParams).toEqual(["Felipe"]);
  });

  it("sin variables no manda parámetros", () => {
    const r = buildTemplateSendParams({ variable_count: 0, variables_origen: null }, contacto);
    expect(r.bodyParams).toBeUndefined();
  });

  it("usa el nombre genérico cuando el contacto no tiene nombre usable", () => {
    const r = buildTemplateSendParams(
      { variable_count: 2, variables_origen: [{ origen: "nombre" }, { origen: "variable2" }] },
      { ...contacto, name: "👋" }
    );
    expect(r.bodyParams?.[0]).toBe("que tal");
    expect(r.bodyParams?.[1]).toBe("23 de octubre");
  });

  it("aplana los saltos de línea del dato, que Meta rechaza", () => {
    const r = buildTemplateSendParams(
      { variable_count: 1, variables_origen: [{ origen: "variable2" }] },
      { ...contacto, variable2: "23 de\n\noctubre" }
    );
    expect(r.bodyParams).toEqual(["23 de octubre"]);
  });
});

describe("cuántas variables tiene un texto", () => {
  it("cuenta hasta la más alta, no cuántas veces aparecen", () => {
    expect(cuantasVariables("Hola {{1}}, tu cita es el {{2}} a las {{3}}")).toBe(3);
    expect(cuantasVariables("Hola {{1}}, recuerda {{1}}")).toBe(1);
    expect(cuantasVariables("Sin variables")).toBe(0);
  });
});

describe("ajustar el emparejamiento al editar el texto", () => {
  it("conserva lo ya elegido y completa lo que falta", () => {
    const actual = ajustarVariables([{ origen: "nombre" }], 3);
    expect(actual).toHaveLength(3);
    expect(actual[0].origen).toBe("nombre");
  });

  it("recorta si el texto quedó con menos variables", () => {
    const actual = ajustarVariables([{ origen: "nombre" }, { origen: "variable2" }, { origen: "variable3" }], 1);
    expect(actual).toEqual([{ origen: "nombre" }]);
  });
});

describe("validación al importar", () => {
  it("acepta números escritos como la gente los escribe", () => {
    expect(normalizarValor("1.250.000", "numero")).toEqual({ ok: true, valor: "1.250.000" });
    expect(normalizarValor("$ 45.000", "numero")).toEqual({ ok: true, valor: "$ 45.000" });
  });

  it("rechaza lo que no es un número", () => {
    const r = normalizarValor("mañana", "numero");
    expect(r.ok).toBe(false);
  });

  it("deja la fecha tal como la escribió la persona", () => {
    expect(normalizarValor("23 de octubre a las 8 pm", "fecha")).toEqual({
      ok: true,
      valor: "23 de octubre a las 8 pm",
    });
  });

  it("una celda vacía no es un error", () => {
    expect(normalizarValor("   ", "numero")).toEqual({ ok: true, valor: "" });
  });
});

describe("leer el valor del contacto", () => {
  it("devuelve null cuando está vacío, para poder avisar", () => {
    expect(valorDeContacto("variable4", contacto)).toBeNull();
    expect(valorDeContacto("variable2", contacto)).toBe("23 de octubre");
  });
});

// El fallo del 2 oct 2026: un cliente no podía crear su plantilla y Meta
// respondía "Al componente de tipo BODY le faltan los campos esperados
// (example)". La causa eran tres formas distintas de contar las variables.
describe("contar variables: una sola forma para todos", () => {
  it("cuenta igual con espacios dentro de las llaves", () => {
    // Este era el caso roto: el emparejamiento veía 1 y el envío a Meta veía
    // 0, así que la plantilla viajaba sin el ejemplo obligatorio.
    expect(cuantasVariables("Hola {{ 1 }} que tal")).toBe(1);
    expect(normalizarVariables("Hola {{ 1 }} que tal")).toBe("Hola {{1}} que tal");
  });

  it("una variable repetida sigue siendo una", () => {
    // Antes contaba 2 y le mandaba dos ejemplos a Meta para una sola variable.
    expect(cuantasVariables("Hola {{1}}, gracias {{1}}")).toBe(1);
  });

  it("normalizar no toca nada más del texto", () => {
    expect(normalizarVariables("Precio: $1.000 {{2}} y {{ 3 }}")).toBe("Precio: $1.000 {{2}} y {{3}}");
  });
});

describe("numeración sin huecos", () => {
  it("detecta que falta {{1}} cuando solo se usa {{2}}", () => {
    expect(variablesSaltadas("Tu cita es el {{2}}")).toEqual([1]);
  });

  it("detecta varios huecos", () => {
    expect(variablesSaltadas("Hola {{1}} el {{4}}")).toEqual([2, 3]);
  });

  it("una numeración correcta no da huecos", () => {
    expect(variablesSaltadas("Hola {{1}}, cita {{2}} a las {{3}}")).toEqual([]);
    expect(variablesSaltadas("Sin variables")).toEqual([]);
  });
});
