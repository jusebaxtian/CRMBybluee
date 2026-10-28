import { describe, expect, it } from "vitest";
import { ESPACIO_BYBLUEE, NOTA_CITA_BYBLUEE, PLANTILLA_MEET_CON_NOTA, notaDeCita, plantillaDeCitaPara } from "./nota-de-cita";
import { elegirPlantillaGuardada, nombresDePlantilla } from "./plantillas-cita";
import { textoDeConfirmacion } from "./mensaje-cita";

describe("nota de las citas de Bybluee", () => {
  it("solo para Bybluee y solo con Meet", () => {
    expect(notaDeCita(ESPACIO_BYBLUEE, true)).toBe(NOTA_CITA_BYBLUEE);
    expect(notaDeCita(ESPACIO_BYBLUEE, false)).toBeNull();
    expect(notaDeCita("otro-espacio", true)).toBeNull();
  });

  it("el mensaje lleva el bloque Importante al final, separado por una linea", () => {
    const t = textoDeConfirmacion({
      nombre: "Ivan",
      titulo: "Conectar API",
      inicioIso: "2026-10-28T19:00:00Z",
      meetUrl: "https://meet.google.com/wsm-dxqx-fzw",
      nota: NOTA_CITA_BYBLUEE,
    });
    expect(t).toContain("💻 Reunión por Meet: https://meet.google.com/wsm-dxqx-fzw\n\n📌 *Importante:*");
    expect(t.endsWith("durante la reunión.")).toBe(true);
  });

  it("sin nota, el mensaje queda igual que antes", () => {
    const t = textoDeConfirmacion({ nombre: "Ivan", titulo: "X", inicioIso: "2026-10-28T19:00:00Z", meetUrl: null });
    expect(t).not.toContain("Importante");
  });

  it("Bybluee prefiere la plantilla con nota, pero usa la de siempre mientras no este aprobada", () => {
    const p = plantillaDeCitaPara(ESPACIO_BYBLUEE, true);
    expect(nombresDePlantilla(p)[0]).toBe(PLANTILLA_MEET_CON_NOTA);
    const enRevision = [
      { meta_template_name: PLANTILLA_MEET_CON_NOTA, status: "PENDING" },
      { meta_template_name: "confirmacion_cita_meet", status: "APPROVED" },
    ];
    expect(elegirPlantillaGuardada(enRevision, p)?.meta_template_name).toBe("confirmacion_cita_meet");
    const aprobada = [{ ...enRevision[0], status: "APPROVED" }, enRevision[1]];
    expect(elegirPlantillaGuardada(aprobada, p)?.meta_template_name).toBe(PLANTILLA_MEET_CON_NOTA);
  });

  it("los demas espacios no cambian de plantilla", () => {
    expect(nombresDePlantilla(plantillaDeCitaPara("otro-espacio", true))[0]).toBe("confirmacion_cita_meet");
  });
});
