import { describe, expect, it } from "vitest";
import { enlacesDelAdministrador } from "./enlaces-meta";

describe("enlacesDelAdministrador", () => {
  it("arma los enlaces con el id de la cuenta", () => {
    const e = enlacesDelAdministrador("1234567890");
    expect(e.map((x) => x.clave)).toEqual(["resumen", "numeros", "plantillas", "estadisticas", "pago"]);
    expect(e[4].ayuda).toContain("1234567890");
    expect(e[2].url).toBe("https://business.facebook.com/wa/manage/message-templates/?waba_id=1234567890");
  });
  it("sin id no arma enlaces", () => {
    expect(enlacesDelAdministrador("  ")).toEqual([]);
  });
});
