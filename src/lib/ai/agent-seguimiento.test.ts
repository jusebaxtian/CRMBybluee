import { describe, it, expect } from "vitest";
import { buildFollowupSystemPrompt, followupFinalInstruction, type ContextoDeSeguimiento } from "@/lib/ai/agent";

const contexto = (extra: Partial<ContextoDeSeguimiento> = {}): ContextoDeSeguimiento => ({
  numero: 2,
  minutosSinResponder: 65,
  mensajesDelCliente: 1,
  ultimoDelCliente: "¡Hola! Quiero más información",
  ultimoNuestro: "Antes de darte toda la información, responde unas preguntas rápidas.",
  seguimientosPrevios: ["Recuerda que tu primer módulo es gratis."],
  ...extra,
});

describe("prompt del seguimiento", () => {
  it("sin contexto conserva lo de siempre: el enfoque y la persona", () => {
    const p = buildFollowupSystemPrompt("William", "Vendemos bachillerato", "Habla del módulo gratis");
    expect(p).toContain("Vendemos bachillerato");
    expect(p).toContain("Habla del módulo gratis");
    expect(p).not.toContain("SITUACION DE ESTA CONVERSACION");
  });

  it("el enfoque del dueño ya no manda por encima de todo: se adapta a la situacion", () => {
    const p = buildFollowupSystemPrompt("William", "x", "Habla del módulo gratis", contexto());
    expect(p).not.toContain("manda sobre cualquier ejemplo");
    expect(p).toContain("adáptala a la situación real");
    expect(p).toContain("sin repetir lo ya dicho");
  });

  it("le dice al modelo lo que paso: cuanto escribio el cliente, que dijo y que quedo sin respuesta", () => {
    const p = buildFollowupSystemPrompt("William", "x", "f", contexto());
    expect(p).toContain("solo ha escrito UN mensaje");
    expect(p).toContain("Quiero más información");
    expect(p).toContain("responde unas preguntas rápidas");
    expect(p).toContain("Hace 1 hora que el cliente no responde");
  });

  it("incluye los seguimientos que ya se enviaron para no repetirlos", () => {
    const p = buildFollowupSystemPrompt("William", "x", "f", contexto());
    expect(p).toContain("Ya le enviaste 1 seguimiento(s)");
    expect(p).toContain("Recuerda que tu primer módulo es gratis.");
    expect(p).toContain("No repitas NINGUNA idea");
  });

  it("exige retomar lo pendiente en vez de abrir un tema nuevo", () => {
    expect(buildFollowupSystemPrompt("W", "x", "f", contexto())).toContain("Continúa DESDE donde quedó la conversación");
  });

  it("sin seguimientos previos no inventa una lista", () => {
    const p = buildFollowupSystemPrompt("W", "x", "f", contexto({ seguimientosPrevios: [], numero: 1 }));
    expect(p).not.toContain("Ya le enviaste");
  });

  it("un cliente que nunca escribio se dice tal cual", () => {
    expect(buildFollowupSystemPrompt("W", "x", "f", contexto({ mensajesDelCliente: 0, ultimoDelCliente: null }))).toContain("todavia no ha escrito nada");
  });

  it("tras un borrador repetido, se le muestra a que se parecio y se le pide distinto", () => {
    const p = buildFollowupSystemPrompt("W", "x", "f", contexto({ repiteA: "Recuerda que tu primer módulo es gratis." }));
    expect(p).toContain("IMPORTANTE: tu borrador anterior salió casi igual");
    expect(p).toContain("Escríbelo claramente distinto");
  });

  it("recorta los mensajes largos para no inflar el prompt", () => {
    const p = buildFollowupSystemPrompt("W", "x", "f", contexto({ ultimoNuestro: "a".repeat(5000) }));
    expect(p.length).toBeLessThan(5000);
  });

  it("la instruccion final pide continuar y no repetir cuando hay contexto, y es la de antes cuando no", () => {
    expect(followupFinalInstruction(2, "foco", contexto())).toContain("no repitas nada de lo que ya dijiste");
    expect(followupFinalInstruction(2, "foco")).not.toContain("no repitas nada");
    expect(followupFinalInstruction(3, "foco")).toContain("seguimiento #3");
  });
});
