import { describe, it, expect } from "vitest";
import { validarPlantilla } from "@/lib/templates/validar-creacion";
import { buildTemplateSendParams, motivoDeNoEnviar } from "@/lib/whatsapp/variables";

/**
 * El caso real que destapó todo esto: ConexionFit Colombia, 1 oct 2026. Una
 * plantilla de confirmación de cita con dos variables se guardaba sin
 * emparejamiento --porque el formulario usa /api/create-template y toda la
 * validación vivía en una acción de servidor sin llamadores-- y cada envío
 * moría con el 132000 de Meta.
 */
const CUERPO_DE_LA_CITA = "¡Hola! Tu sesión es el {{1}} a las {{2}}.";
const EMPAREJADAS = JSON.stringify([
  { origen: "variable2", ejemplo: "lunes 1 de octubre" },
  { origen: "variable3", ejemplo: "7:50 p. m." },
]);

describe("validarPlantilla", () => {
  it("devuelve el emparejamiento y sus ejemplos para guardarlos", () => {
    const r = validarPlantilla(CUERPO_DE_LA_CITA, EMPAREJADAS);
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(r.variableCount).toBe(2);
    expect(r.variables.map((v) => v.origen)).toEqual(["variable2", "variable3"]);
    expect(r.ejemplos).toEqual(["lunes 1 de octubre", "7:50 p. m."]);
  });

  it("deja el cuerpo canónico: {{ 1 }} escrito con espacios cuenta igual", () => {
    const r = validarPlantilla("Hola {{ 1 }}", JSON.stringify([{ origen: "nombre" }]));
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(r.bodyText).toBe("Hola {{1}}");
    expect(r.variableCount).toBe(1);
  });

  it("no deja crear una plantilla con variables sin emparejar", () => {
    const r = validarPlantilla(CUERPO_DE_LA_CITA, "[]");
    expect("error" in r && r.error).toContain("2 variable");
  });

  it("exige que la numeración empiece en {{1}} y no salte", () => {
    const r = validarPlantilla("Tu cita es el {{2}}", JSON.stringify([{ origen: "variable2" }]));
    expect("error" in r && r.error).toContain("{{1}}");
  });

  it("la {{1}} se puede emparejar con algo que no sea el nombre", () => {
    const r = validarPlantilla(CUERPO_DE_LA_CITA, EMPAREJADAS);
    if ("error" in r) throw new Error(r.error);
    // Y lo emparejado es lo que viaja en el envío: la {{1}} manda la fecha,
    // no el nombre del contacto.
    const { bodyParams } = buildTemplateSendParams(
      { variable_count: r.variableCount, variables_origen: r.variables },
      {
        name: "Felipe",
        wa_id: "573001112233",
        variable2: "lunes 1 de octubre",
        variable3: "7:50 p. m.",
      }
    );
    expect(bodyParams).toEqual(["lunes 1 de octubre", "7:50 p. m."]);
  });
});

describe("plantilla de varias variables sin emparejar", () => {
  it("se marca para que el envío se pare en vez de morir con el 132000", () => {
    const { sinEmparejar, bodyParams } = buildTemplateSendParams(
      { variable_count: 2, variables_origen: null },
      { name: "Felipe", wa_id: "573001112233" }
    );
    expect(sinEmparejar).toBe(true);
    // Lo que se habría mandado: un solo dato para dos variables.
    expect(bodyParams).toEqual(["Felipe"]);
  });

  it("con una sola variable no se marca: el nombre sigue siendo lo correcto", () => {
    const { sinEmparejar, bodyParams } = buildTemplateSendParams(
      { variable_count: 1, variables_origen: null },
      { name: "Felipe", wa_id: "573001112233" }
    );
    expect(sinEmparejar).toBe(false);
    expect(bodyParams).toEqual(["Felipe"]);
  });
});

/**
 * El 1 oct 2026, ya con la plantilla aprobada y emparejada, el envio desde el
 * chat seguia fallando: "Falta un dato obligatorio en el mensaje". La consulta
 * del contacto traia solo wa_id y name, asi que las columnas propias llegaban
 * vacias y el parametro viajaba en blanco.
 */
describe("un parametro en blanco nunca sale", () => {
  const plantillaDeLaCita = {
    variable_count: 2,
    variables_origen: [{ origen: "variable2" as const }, { origen: "variable3" as const }],
  };

  it("avisa que falta el dato cuando el contacto no lo tiene", () => {
    const r = buildTemplateSendParams(plantillaDeLaCita, {
      name: "Juan Carlos",
      wa_id: "573006027659",
      variable2: null,
      variable3: null,
    });
    expect(r.faltan).toEqual(["variable2", "variable3"]);
    expect(motivoDeNoEnviar(r)).toContain("le falta el dato");
  });

  it("los nombra como el cliente los llamo, no como variable2", () => {
    const r = buildTemplateSendParams(plantillaDeLaCita, {
      name: "Juan Carlos",
      wa_id: "573006027659",
      variable2: null,
      variable3: "7:50 p. m.",
    });
    const etiquetas = new Map([["variable2", "Día de la sesión"]]);
    expect(motivoDeNoEnviar(r, etiquetas)).toContain("Día de la sesión");
  });

  it("con los datos puestos deja enviar", () => {
    const r = buildTemplateSendParams(plantillaDeLaCita, {
      name: "Juan Carlos",
      wa_id: "573006027659",
      variable2: "lunes 1 de octubre",
      variable3: "7:50 p. m.",
    });
    expect(motivoDeNoEnviar(r)).toBeNull();
    expect(r.bodyParams).toEqual(["lunes 1 de octubre", "7:50 p. m."]);
  });
});
