import { describe, expect, it } from "vitest";
import { comoEnviar } from "./envio";

describe("comoEnviar", () => {
  it("con la ventana abierta sale el mensaje libre aunque haya respaldo", () => {
    expect(comoEnviar({ texto: "Hola", templateId: "t1" }, true)).toEqual({ tipo: "texto" });
  });
  it("con la ventana cerrada sale la plantilla de respaldo", () => {
    expect(comoEnviar({ texto: "Hola", templateId: "t1" }, false)).toEqual({ tipo: "plantilla", templateId: "t1" });
  });
  it("solo plantilla: sale la plantilla con la ventana abierta o cerrada", () => {
    expect(comoEnviar({ texto: null, templateId: "t1" }, true)).toEqual({ tipo: "plantilla", templateId: "t1" });
    expect(comoEnviar({ texto: null, templateId: "t1" }, false)).toEqual({ tipo: "plantilla", templateId: "t1" });
  });
  it("mensaje libre sin respaldo y ventana cerrada: no se envia y dice por que", () => {
    expect(comoEnviar({ texto: "Hola", templateId: null }, false).tipo).toBe("ninguno");
  });
});
