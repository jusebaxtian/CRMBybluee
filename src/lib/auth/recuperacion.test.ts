import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";

// Base simulada: solo lo que usa verificarCodigo/enviarCodigoPorWhatsApp.
const estado = {
  usuario: { user_id: "u1", phone: "573001234567" } as { user_id: string; phone: string | null } | null,
  registro: null as null | { id: string; codigo_hash: string; expira_en: string; intentos: number; usado_en: string | null },
  codigosRecientes: 0,
  updates: [] as Record<string, unknown>[],
  inserts: [] as Record<string, unknown>[],
  cuenta: { phone_number_id: "pn", access_token: "tok" } as { phone_number_id: string; access_token: string } | null,
};

function cadena(tabla: string) {
  const q: Record<string, unknown> = {};
  const self = () => q;
  Object.assign(q, {
    select: (_c: string, opts?: { count?: string; head?: boolean }) => {
      if (opts?.head) return { eq: () => ({ gte: async () => ({ count: estado.codigosRecientes }) }) };
      return q;
    },
    eq: self,
    order: self,
    limit: self,
    maybeSingle: async () => {
      if (tabla === "codigos_recuperacion") return { data: estado.registro };
      if (tabla === "platform_whatsapp_account") return { data: estado.cuenta };
      if (tabla === "platform_settings") return { data: { value: "codigo_recuperacion" } };
      return { data: null };
    },
    update: (v: Record<string, unknown>) => {
      estado.updates.push(v);
      return { eq: async () => ({}) };
    },
    insert: async (v: Record<string, unknown>) => {
      estado.inserts.push(v);
      return { error: null };
    },
  });
  return q;
}

const envios: unknown[][] = [];
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: async () => ({ data: estado.usuario ? [estado.usuario] : [] }),
    from: (tabla: string) => cadena(tabla),
    auth: { admin: { updateUserById: async () => ({ error: null }) } },
  }),
}));
vi.mock("@/lib/whatsapp/graph", () => ({
  sendTemplateMessage: async (...args: unknown[]) => {
    envios.push(args);
    return { messages: [{ id: "wamid" }] };
  },
}));

import { verificarCodigo, enviarCodigoPorWhatsApp, enmascarar } from "./recuperacion";

const hash = (c: string) => createHash("sha256").update(c).digest("hex");
const enDiezMin = () => new Date(Date.now() + 10 * 60_000).toISOString();

beforeEach(() => {
  estado.usuario = { user_id: "u1", phone: "573001234567" };
  estado.registro = { id: "r1", codigo_hash: hash("123456"), expira_en: enDiezMin(), intentos: 0, usado_en: null };
  estado.codigosRecientes = 0;
  estado.updates = [];
  estado.inserts = [];
  estado.cuenta = { phone_number_id: "pn", access_token: "tok" };
  envios.length = 0;
});

describe("verificarCodigo — codigo de recuperacion por WhatsApp", () => {
  it("acepta el codigo correcto y lo marca usado", async () => {
    expect(await verificarCodigo("a@b.co", "123456")).toEqual({ ok: true, userId: "u1" });
    expect(estado.updates[0]).toHaveProperty("usado_en");
  });
  it("acepta el codigo aunque venga con espacios", async () => {
    expect((await verificarCodigo("a@b.co", "123 456")).ok).toBe(true);
  });
  it("rechaza un codigo incorrecto y suma un intento", async () => {
    expect(await verificarCodigo("a@b.co", "000000")).toEqual({ ok: false, motivo: "incorrecto" });
    expect(estado.updates[0]).toEqual({ intentos: 1 });
  });
  it("bloquea al quinto intento fallido", async () => {
    estado.registro!.intentos = 4;
    expect(await verificarCodigo("a@b.co", "000000")).toEqual({ ok: false, motivo: "bloqueado" });
    estado.registro!.intentos = 5;
    expect(await verificarCodigo("a@b.co", "123456")).toEqual({ ok: false, motivo: "bloqueado" });
  });
  it("rechaza un codigo vencido o ya usado", async () => {
    estado.registro!.expira_en = new Date(Date.now() - 1000).toISOString();
    expect(await verificarCodigo("a@b.co", "123456")).toEqual({ ok: false, motivo: "vencido" });
    estado.registro = { ...estado.registro!, expira_en: enDiezMin(), usado_en: new Date().toISOString() };
    expect(await verificarCodigo("a@b.co", "123456")).toEqual({ ok: false, motivo: "sin_codigo" });
  });
  it("correo sin cuenta", async () => {
    estado.usuario = null;
    expect(await verificarCodigo("nadie@b.co", "123456")).toEqual({ ok: false, motivo: "sin_cuenta" });
  });
});

describe("enviarCodigoPorWhatsApp", () => {
  it("guarda solo el hash, manda 6 digitos por plantilla al WhatsApp del espacio y enmascara el numero", async () => {
    const r = await enviarCodigoPorWhatsApp("a@b.co");
    expect(r).toEqual({ ok: true, telefonoEnmascarado: "•••• 4567" });
    const [pn, tok, to, plantilla, idioma, params, , boton] = envios[0] as [
      string, string, string, string, string, string[], unknown, { index: number; value: string },
    ];
    expect([pn, tok, to, plantilla, idioma]).toEqual(["pn", "tok", "573001234567", "codigo_recuperacion", "es"]);
    expect(params[0]).toMatch(/^\d{6}$/);
    expect(boton).toEqual({ index: 0, value: params[0] });
    expect(estado.inserts[0]).toMatchObject({ user_id: "u1", codigo_hash: hash(params[0]) });
    expect(String(estado.inserts[0].codigo_hash)).not.toContain(params[0]);
  });
  it("no manda mas de 3 codigos en 15 minutos", async () => {
    estado.codigosRecientes = 3;
    expect(await enviarCodigoPorWhatsApp("a@b.co")).toEqual({ ok: false, motivo: "demasiados" });
    expect(envios).toHaveLength(0);
  });
  it("sin cuenta o sin WhatsApp no envia nada", async () => {
    estado.usuario = null;
    expect(await enviarCodigoPorWhatsApp("x@b.co")).toEqual({ ok: false, motivo: "sin_cuenta" });
    estado.usuario = { user_id: "u1", phone: null };
    expect(await enviarCodigoPorWhatsApp("a@b.co")).toEqual({ ok: false, motivo: "sin_whatsapp" });
    expect(envios).toHaveLength(0);
  });
  it("enmascarar deja solo los ultimos 4 digitos", () => {
    expect(enmascarar("573001234567")).toBe("•••• 4567");
  });
});
