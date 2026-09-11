import { describe, it, expect } from "vitest";
import {
  interpretarMensajeDeAlta,
  esOrigenDeMeta,
  mensajeDeAlta,
  EVENTOS_FIN,
} from "@/lib/whatsapp/embedded-signup";

/**
 * Un cliente real completo el alta entera el 11 de septiembre de 2026 y al
 * volver al CRM vio un rojo diciendo que la habia cancelado. Su espacio quedo
 * sin numero conectado.
 *
 * La causa: el codigo solo escuchaba el evento "FINISH" y Meta tiene seis
 * finales. Cualquier otro se descartaba en silencio.
 */
const mensaje = (evento: string, datos: Record<string, unknown> = {}) =>
  JSON.stringify({ type: "WA_EMBEDDED_SIGNUP", event: evento, data: datos, version: 3 });

const COMPLETO = { waba_id: "waba-1", phone_number_id: "phone-1", business_id: "biz-1" };

describe("los seis finales de Meta", () => {
  it("FINISH con numero da una conexion lista", () => {
    expect(interpretarMensajeDeAlta(mensaje("FINISH", COMPLETO))).toEqual({
      tipo: "listo",
      wabaId: "waba-1",
      phoneNumberId: "phone-1",
      evento: "FINISH",
    });
  });

  it("las otras cuatro variantes de fin tambien conectan, no se descartan", () => {
    for (const evento of EVENTOS_FIN) {
      const r = interpretarMensajeDeAlta(mensaje(evento, COMPLETO));
      expect(r.tipo, `${evento} deberia conectar`).toBe("listo");
    }
  });

  it("FINISH_ONLY_WABA termina sin numero y se dice asi", () => {
    const r = interpretarMensajeDeAlta(mensaje("FINISH_ONLY_WABA", { waba_id: "waba-9" }));
    expect(r).toEqual({ tipo: "sin-numero", wabaId: "waba-9", evento: "FINISH_ONLY_WABA" });
    expect(mensajeDeAlta(r)).toContain("no se seleccionó un número");
  });

  it("CANCEL dice en que paso se cerro la ventana", () => {
    const r = interpretarMensajeDeAlta(mensaje("CANCEL", { current_step: "PHONE_NUMBER_SETUP" }));
    expect(r).toEqual({ tipo: "cancelado", paso: "PHONE_NUMBER_SETUP" });
    expect(mensajeDeAlta(r)).toContain("PHONE_NUMBER_SETUP");
  });

  it("ERROR reporta lo que dijo Meta, no una suposicion", () => {
    const r = interpretarMensajeDeAlta(mensaje("ERROR", { error_message: "Numero ya registrado" }));
    expect(mensajeDeAlta(r)).toContain("Numero ya registrado");
  });
});

describe("formato del mensaje", () => {
  it("acepta el objeto ya deserializado, no solo la cadena", () => {
    // Meta manda una cadena JSON hoy. Aceptar tambien el objeto es gratis y
    // evita que un cambio de formato vuelva a dejar clientes colgados.
    const r = interpretarMensajeDeAlta({ type: "WA_EMBEDDED_SIGNUP", event: "FINISH", data: COMPLETO });
    expect(r.tipo).toBe("listo");
  });

  it("ignora el ruido de otros iframes", () => {
    expect(interpretarMensajeDeAlta("no es json").tipo).toBe("ignorar");
    expect(interpretarMensajeDeAlta(JSON.stringify({ type: "OTRA_COSA" })).tipo).toBe("ignorar");
    expect(interpretarMensajeDeAlta(null).tipo).toBe("ignorar");
    expect(interpretarMensajeDeAlta(42).tipo).toBe("ignorar");
  });

  it("un fin sin waba_id no se toma por bueno", () => {
    expect(interpretarMensajeDeAlta(mensaje("FINISH", { phone_number_id: "p" })).tipo).toBe("sin-numero");
  });
});

describe("origen del mensaje", () => {
  it("acepta los dominios de Meta", () => {
    for (const o of [
      "https://www.facebook.com",
      "https://business.facebook.com",
      "https://web.facebook.com",
      "https://facebook.com",
    ]) {
      expect(esOrigenDeMeta(o), o).toBe(true);
    }
  });

  it("rechaza un dominio que solo TERMINA en facebook.com", () => {
    // La comprobacion anterior era origin.endsWith("facebook.com"), que acepta
    // esto. El mensaje lleva los identificadores de la cuenta del cliente.
    expect(esOrigenDeMeta("https://evil-facebook.com")).toBe(false);
    expect(esOrigenDeMeta("https://notfacebook.com")).toBe(false);
  });

  it("rechaza basura", () => {
    expect(esOrigenDeMeta("")).toBe(false);
    expect(esOrigenDeMeta("null")).toBe(false);
  });
});
