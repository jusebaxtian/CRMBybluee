import { describe, it, expect, beforeAll } from "vitest";
import { cifrar, descifrar, firmarEstado, leerEstado } from "@/lib/integraciones/cifrado";
import { ALCANCES, ALCANCE_EVENTOS, faltaPermisoDeEventos, urlDeAutorizacion } from "@/lib/integraciones/google/oauth";

beforeAll(() => {
  process.env.INTEGRATIONS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
});

describe("cifrado de secretos", () => {
  it("lo que se cifra se recupera igual", () => {
    expect(descifrar(cifrar("1//0gRefreshTokenDeEjemplo"))).toBe("1//0gRefreshTokenDeEjemplo");
  });

  it("el texto cifrado no contiene el secreto y cambia en cada cifrado", () => {
    const a = cifrar("secreto-claro");
    const b = cifrar("secreto-claro");
    expect(a).not.toContain("secreto-claro");
    expect(a).not.toBe(b);
  });

  it("un texto alterado se rechaza", () => {
    const [v, iv, tag, dato] = cifrar("abc").split(".");
    const roto = [v, iv, tag, dato.slice(0, -2) + (dato.endsWith("AA") ? "BB" : "AA")].join(".");
    expect(() => descifrar(roto)).toThrow();
  });

  it("con otra llave no se puede abrir", () => {
    const c = cifrar("abc");
    process.env.INTEGRATIONS_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
    expect(() => descifrar(c)).toThrow();
    process.env.INTEGRATIONS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  });

  it("sin llave o con una llave corta falla con un mensaje claro", () => {
    const original = process.env.INTEGRATIONS_ENCRYPTION_KEY;
    delete process.env.INTEGRATIONS_ENCRYPTION_KEY;
    expect(() => cifrar("x")).toThrow(/INTEGRATIONS_ENCRYPTION_KEY/);
    process.env.INTEGRATIONS_ENCRYPTION_KEY = Buffer.alloc(8).toString("base64");
    expect(() => cifrar("x")).toThrow(/32 bytes/);
    process.env.INTEGRATIONS_ENCRYPTION_KEY = original;
  });
});

describe("estado firmado del flujo con Google", () => {
  it("devuelve el usuario que lo pidio", () => {
    expect(leerEstado(firmarEstado("user-1"))).toBe("user-1");
  });

  it("vence a los 10 minutos", () => {
    const ahora = Date.now();
    const estado = firmarEstado("user-1", ahora);
    expect(leerEstado(estado, ahora + 9 * 60_000)).toBe("user-1");
    expect(leerEstado(estado, ahora + 11 * 60_000)).toBeNull();
  });

  it("una firma falsa o un estado alterado no vale", () => {
    const estado = firmarEstado("user-1");
    const [carga] = estado.split(".");
    expect(leerEstado(`${carga}.firmafalsa`)).toBeNull();
    const otraCarga = Buffer.from(JSON.stringify({ u: "user-2", n: "x", e: Date.now() + 60_000 })).toString("base64url");
    expect(leerEstado(`${otraCarga}.${estado.split(".")[1]}`)).toBeNull();
    expect(leerEstado("basura")).toBeNull();
  });
});

describe("permisos y direccion de Google", () => {
  it("la direccion pide acceso permanente y los permisos minimos", () => {
    const url = new URL(urlDeAutorizacion({ clientId: "id.apps.googleusercontent.com", redirectUri: "https://crmbybluee.blue/api/google-calendar/callback", estado: "e" }));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("redirect_uri")).toBe("https://crmbybluee.blue/api/google-calendar/callback");
    const pedidos = url.searchParams.get("scope")!.split(" ");
    expect(pedidos).toEqual(ALCANCES);
    // Nada de permisos amplios.
    expect(pedidos).not.toContain("https://www.googleapis.com/auth/calendar");
    expect(pedidos).not.toContain("https://www.googleapis.com/auth/calendar.events");
  });

  it("detecta cuando la persona desmarco el permiso de eventos", () => {
    expect(faltaPermisoDeEventos(`openid email ${ALCANCE_EVENTOS}`)).toBe(false);
    expect(faltaPermisoDeEventos("openid https://www.googleapis.com/auth/userinfo.email")).toBe(true);
    expect(faltaPermisoDeEventos(undefined)).toBe(true);
  });
});
