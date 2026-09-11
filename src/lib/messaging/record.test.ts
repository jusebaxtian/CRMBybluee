import { describe, it, expect } from "vitest";
import { recordOutboundMessage } from "@/lib/messaging/record";

/**
 * Lo que se prueba aqui es la invariante que motiva toda la capa: todo mensaje
 * saliente escribe en `messages` Y adelanta `conversations.last_message_at`.
 *
 * Ningun disparador mantiene ese campo, asi que si una ruta se lo salta, la
 * bandeja muestra una hora vieja y nadie se entera. Eso llevaba pasando con
 * las respuestas del agente de IA.
 */

type Escritura = { tabla: string; operacion: string; datos: Record<string, unknown> };

function espiarSupabase(fallo?: { tabla: string; mensaje: string }) {
  const escrituras: Escritura[] = [];
  const errorDe = (tabla: string) =>
    fallo?.tabla === tabla ? { message: fallo.mensaje } : null;

  const supabase = {
    from(tabla: string) {
      return {
        insert: async (datos: Record<string, unknown>) => {
          escrituras.push({ tabla, operacion: "insert", datos });
          return { error: errorDe(tabla) };
        },
        update: (datos: Record<string, unknown>) => {
          const registro: Escritura = { tabla, operacion: "update", datos };
          escrituras.push(registro);
          const cadena = {
            eq: (columna: string, valor: unknown) => {
              registro.datos = { ...registro.datos, [`where_${columna}`]: valor };
              return cadena;
            },
            then: (resolver: (v: unknown) => unknown) =>
              Promise.resolve({ error: errorDe(tabla) }).then(resolver),
          };
          return cadena;
        },
      };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  return { supabase, escrituras };
}

const BASE = { conversationId: "conv-1", messageType: "text" as const, body: "hola" };

describe("recordOutboundMessage — la invariante", () => {
  it("escribe el mensaje y adelanta la conversacion, siempre", async () => {
    const { supabase, escrituras } = espiarSupabase();
    await recordOutboundMessage(supabase, BASE);

    const mensaje = escrituras.find((e) => e.tabla === "messages");
    const conversacion = escrituras.find((e) => e.tabla === "conversations");

    expect(mensaje).toBeDefined();
    expect(conversacion).toBeDefined();
    expect(conversacion!.datos.last_message_at).toEqual(expect.any(String));
    expect(conversacion!.datos.where_id).toBe("conv-1");
  });

  it("adelanta la conversacion tambien cuando el mensaje se guarda como fallido", async () => {
    // Un envio rechazado por Meta igual deja rastro en el chat, asi que la
    // conversacion tiene que moverse: si no, el fallo queda invisible.
    const { supabase, escrituras } = espiarSupabase();
    await recordOutboundMessage(supabase, {
      ...BASE,
      status: "failed",
      errorDetail: "131047",
    });

    expect(escrituras.some((e) => e.tabla === "conversations")).toBe(true);
    const mensaje = escrituras.find((e) => e.tabla === "messages")!;
    expect(mensaje.datos.status).toBe("failed");
    expect(mensaje.datos.error_detail).toBe("131047");
  });

  it("marca direccion saliente sin que el llamador tenga que decirlo", async () => {
    const { supabase, escrituras } = espiarSupabase();
    await recordOutboundMessage(supabase, BASE);
    expect(escrituras.find((e) => e.tabla === "messages")!.datos.direction).toBe("out");
  });
});

describe("valores por defecto", () => {
  it("no marca como atendido por una persona salvo que se pida", async () => {
    // sent_by_support hace que las campañas salten al contacto. Si se colara
    // por defecto, un envio masivo empezaria a omitir gente en silencio.
    const { supabase, escrituras } = espiarSupabase();
    await recordOutboundMessage(supabase, BASE);
    expect(escrituras.find((e) => e.tabla === "messages")!.datos.sent_by_support).toBe(false);
  });

  it("respeta sent_by_support cuando contesta una persona", async () => {
    const { supabase, escrituras } = espiarSupabase();
    await recordOutboundMessage(supabase, { ...BASE, sentBySupport: true });
    expect(escrituras.find((e) => e.tabla === "messages")!.datos.sent_by_support).toBe(true);
  });

  it("deja en null los campos opcionales que no se pasan", async () => {
    const { supabase, escrituras } = espiarSupabase();
    const datos = (await recordOutboundMessage(supabase, BASE), escrituras[0].datos);
    for (const campo of ["media_url", "media_mime_type", "wa_message_id", "buttons", "via_automation_id", "error_detail"]) {
      expect(datos[campo]).toBeNull();
    }
  });

  it("no excluye de seguimientos salvo que se pida", async () => {
    const { supabase, escrituras } = espiarSupabase();
    await recordOutboundMessage(supabase, BASE);
    expect(escrituras.find((e) => e.tabla === "messages")!.datos.exclude_from_followups).toBe(false);
  });
});

describe("errores", () => {
  it("devuelve el error si falla la insercion del mensaje", async () => {
    const { supabase } = espiarSupabase({ tabla: "messages", mensaje: "insert roto" });
    await expect(recordOutboundMessage(supabase, BASE)).resolves.toEqual({ error: "insert roto" });
  });

  it("devuelve el error si falla el adelanto de la conversacion", async () => {
    const { supabase } = espiarSupabase({ tabla: "conversations", mensaje: "update roto" });
    await expect(recordOutboundMessage(supabase, BASE)).resolves.toEqual({ error: "update roto" });
  });

  it("no devuelve error cuando ambas escrituras salen bien", async () => {
    const { supabase } = espiarSupabase();
    await expect(recordOutboundMessage(supabase, BASE)).resolves.toEqual({ error: null });
  });
});
