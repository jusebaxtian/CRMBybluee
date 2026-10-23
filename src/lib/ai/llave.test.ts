import { describe, it, expect } from "vitest";
import { errorDeFormatoDeLlave, errorDeLlaveHeredada, mensajeDeErrorDeProveedor, MODELO_POR_DEFECTO } from "@/lib/ai/llave";

describe("formato de la llave", () => {
  it("Claude pide sk-ant- y avisa si pegaron una de OpenAI", () => {
    expect(errorDeFormatoDeLlave("anthropic", "sk-ant-api03-abc")).toBeNull();
    expect(errorDeFormatoDeLlave("anthropic", "sk-proj-abc")).toMatch(/OpenAI/);
    expect(errorDeFormatoDeLlave("anthropic", "abc123")).toMatch(/sk-ant-/);
  });

  it("GPT acepta sus llaves (sk-, sk-proj-) y rechaza solo las de Anthropic", () => {
    expect(errorDeFormatoDeLlave("openai", "sk-abc")).toBeNull();
    expect(errorDeFormatoDeLlave("openai", "sk-proj-abc")).toBeNull();
    expect(errorDeFormatoDeLlave("openai", "sk-ant-abc")).toMatch(/Anthropic/);
  });
});

describe("llave heredada de otro proveedor", () => {
  it("avisa solo cuando el proveedor cambió", () => {
    expect(errorDeLlaveHeredada("openai", "openai")).toBeNull();
    expect(errorDeLlaveHeredada("openai", "anthropic")).toMatch(/OpenAI.*Anthropic/);
  });
});

describe("errores del proveedor", () => {
  it("traduce los de Anthropic y deja el resto como vienen", () => {
    expect(mensajeDeErrorDeProveedor("anthropic", { status: 401, message: "x" }, "m")).toMatch(/rechazó la API key/);
    expect(mensajeDeErrorDeProveedor("anthropic", { status: 404 }, "modelo-raro")).toContain("modelo-raro");
    expect(mensajeDeErrorDeProveedor("openai", Object.assign(new Error("Incorrect API key"), { status: 401 }), "m")).toBe("Incorrect API key");
  });

  it("el modelo por defecto de Claude es el documentado", () => {
    expect(MODELO_POR_DEFECTO.anthropic).toBe("claude-sonnet-5-5");
    expect(MODELO_POR_DEFECTO.openai).toBe("gpt-4o-mini");
  });
});
