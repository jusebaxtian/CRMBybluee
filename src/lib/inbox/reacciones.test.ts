import { describe, expect, it } from "vitest";
import { reaccionesPorMensaje } from "./reacciones";

const reaccion = (direction: "in" | "out", body: string | null, a: string) => ({
  direction,
  message_type: "reaction",
  body,
  context_wa_message_id: a,
});

describe("reaccionesPorMensaje", () => {
  it("asigna la reaccion al mensaje reaccionado", () => {
    const r = reaccionesPorMensaje([reaccion("in", "👍", "wamid.A")]);
    expect(r.get("wamid.A")).toEqual(["👍"]);
  });

  it("la ultima reaccion de cada lado reemplaza a la anterior", () => {
    const r = reaccionesPorMensaje([reaccion("in", "👍", "wamid.A"), reaccion("in", "❤️", "wamid.A")]);
    expect(r.get("wamid.A")).toEqual(["❤️"]);
  });

  it("una reaccion vacia la quita", () => {
    const r = reaccionesPorMensaje([reaccion("in", "👍", "wamid.A"), reaccion("in", "", "wamid.A"), reaccion("in", null, "wamid.B")]);
    expect(r.has("wamid.A")).toBe(false);
    expect(r.has("wamid.B")).toBe(false);
  });

  it("muestra primero la del cliente y luego la del equipo", () => {
    const r = reaccionesPorMensaje([reaccion("out", "🙏", "wamid.A"), reaccion("in", "😂", "wamid.A")]);
    expect(r.get("wamid.A")).toEqual(["😂", "🙏"]);
  });

  it("ignora mensajes que no son reacciones o no apuntan a nada", () => {
    const r = reaccionesPorMensaje([
      { direction: "in", message_type: "text", body: "hola", context_wa_message_id: "wamid.A" },
      { direction: "in", message_type: "reaction", body: "👍", context_wa_message_id: null },
    ]);
    expect(r.size).toBe(0);
  });
});
