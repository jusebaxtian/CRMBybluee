import { describe, it, expect } from "vitest";
import { cuantasVariablesTiene, textoConVariables } from "@/lib/whatsapp/vista-previa";

describe("textoConVariables", () => {
  it("la primera variable sin emparejar es el nombre", () => {
    expect(textoConVariables("Hola {{1}}, ¿cómo vas?")).toBe("Hola [Nombre], ¿cómo vas?");
  });

  it("usa lo que dice el emparejamiento de cada variable", () => {
    expect(
      textoConVariables("{{1}}: tu cita es el {{2}} en {{3}}", [{ origen: "nombre" }, { origen: "variable2" }, { origen: "variable4" }])
    ).toBe("[Nombre]: tu cita es el [Variable 2] en [Variable 4]");
  });

  it("una variable repetida se muestra igual las dos veces", () => {
    expect(textoConVariables("{{1}} y otra vez {{1}}", [{ origen: "nombre" }])).toBe("[Nombre] y otra vez [Nombre]");
  });

  it("una variable sin dato conocido queda como 'Dato n'", () => {
    expect(textoConVariables("Pedido {{2}}")).toBe("Pedido [Dato 2]");
  });

  it("tolera espacios dentro de las llaves y texto vacío", () => {
    expect(textoConVariables("Hola {{ 1 }}")).toBe("Hola [Nombre]");
    expect(textoConVariables(null)).toBe("");
    expect(textoConVariables("Sin variables")).toBe("Sin variables");
  });
});

describe("cuantasVariablesTiene", () => {
  it("cuenta por el índice más alto", () => {
    expect(cuantasVariablesTiene("Hola {{1}} {{3}}")).toBe(3);
    expect(cuantasVariablesTiene("Sin variables")).toBe(0);
    expect(cuantasVariablesTiene(null)).toBe(0);
  });
});
