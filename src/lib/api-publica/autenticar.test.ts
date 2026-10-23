import { describe, it, expect, beforeEach, vi } from "vitest";
import { huellaDe, generarLlave } from "@/lib/api-publica/llaves";
import { reiniciarLimites } from "@/lib/api-publica/limite";

type Fila = Record<string, unknown>;
let tablas: Record<string, Fila[]> = {};
const escrituras: { tabla: string; tipo: string; datos: unknown }[] = [];

/** Base de mentira: filtra por eq/is/neq y devuelve filas. Suficiente para probar la logica de acceso. */
function falsa() {
  return {
    from(tabla: string) {
      let filas = [...(tablas[tabla] ?? [])];
      const q: Record<string, unknown> = {};
      const encadenar = () => q;
      q.select = encadenar;
      q.order = encadenar;
      q.limit = encadenar;
      q.eq = (c: string, v: unknown) => ((filas = filas.filter((f) => f[c] === v)), q);
      q.neq = (c: string, v: unknown) => ((filas = filas.filter((f) => f[c] !== v)), q);
      q.is = (c: string, v: unknown) => ((filas = filas.filter((f) => (f[c] ?? null) === v)), q);
      q.maybeSingle = async () => ({ data: filas[0] ?? null, error: null });
      q.single = async () => ({ data: filas[0] ?? null, error: null });
      q.update = (datos: unknown) => {
        escrituras.push({ tabla, tipo: "update", datos });
        return { eq: async () => ({ error: null }) };
      };
      q.insert = (datos: unknown) => {
        escrituras.push({ tabla, tipo: "insert", datos });
        return Promise.resolve({ error: null });
      };
      return q;
    },
  };
}

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => falsa() }));

import { autenticar, conApi } from "@/lib/api-publica/autenticar";
import { enviarMensajeApi } from "@/lib/api-publica/enviar";

const llave = generarLlave();
const peticion = (token: string | null = llave.llave) =>
  new Request("https://crmbybluee.blue/api/v1/contactos", { headers: token ? { authorization: `Bearer ${token}` } : {} });

function base(over: Partial<Record<string, Fila[]>> = {}) {
  tablas = {
    api_llaves: [{ id: "k1", workspace_id: "w1", huella: llave.huella, permisos: ["contactos:leer"], vence_el: null, revocada_el: null, ultimo_uso_el: null }],
    workspaces: [{ id: "w1", status: "active", access_disabled: false, plan_id: "p1" }],
    plan_modules: [{ plan_id: "p1", module_key: "api_publica" }],
    api_ajustes: [],
    ...over,
  };
}

async function codigo(r: Response) {
  const j = (await r.json()) as { error?: { codigo: string } };
  return j.error?.codigo ?? null;
}

describe("autenticar", () => {
  beforeEach(() => {
    reiniciarLimites();
    escrituras.length = 0;
    base();
  });

  it("deja pasar una llave válida con su permiso", async () => {
    const r = await autenticar(peticion(), "contactos:leer");
    expect("ctx" in r).toBe(true);
    if ("ctx" in r) expect(r.ctx.workspaceId).toBe("w1");
  });

  it("rechaza sin llave, con llave desconocida o revocada", async () => {
    const sin = await autenticar(peticion(null), null);
    expect("respuesta" in sin && (await codigo(sin.respuesta))).toBe("llave_invalida");
    const otra = await autenticar(peticion(generarLlave().llave), null);
    expect("respuesta" in otra && (await codigo(otra.respuesta))).toBe("llave_invalida");

    tablas.api_llaves[0].revocada_el = "2026-10-01T00:00:00Z";
    const revocada = await autenticar(peticion(), null);
    expect("respuesta" in revocada && (await codigo(revocada.respuesta))).toBe("llave_invalida");
  });

  it("rechaza una llave vencida", async () => {
    tablas.api_llaves[0].vence_el = "2020-01-01T00:00:00Z";
    const r = await autenticar(peticion(), null);
    expect("respuesta" in r && (await codigo(r.respuesta))).toBe("llave_vencida");
  });

  it("rechaza si falta el permiso", async () => {
    const r = await autenticar(peticion(), "mensajes:enviar");
    expect("respuesta" in r && r.respuesta.status).toBe(403);
    expect("respuesta" in r && (await codigo(r.respuesta))).toBe("permiso_denegado");
  });

  it("rechaza si el plan no tiene el módulo", async () => {
    base({ plan_modules: [] });
    const r = await autenticar(peticion(), null);
    expect("respuesta" in r && (await codigo(r.respuesta))).toBe("modulo_no_incluido");
  });

  it("rechaza cuentas vencidas o bloqueadas", async () => {
    tablas.workspaces[0].status = "past_due";
    const a = await autenticar(peticion(), null);
    expect("respuesta" in a && (await codigo(a.respuesta))).toBe("cuenta_bloqueada");
    tablas.workspaces[0].status = "active";
    tablas.workspaces[0].access_disabled = true;
    const b = await autenticar(peticion(), null);
    expect("respuesta" in b && (await codigo(b.respuesta))).toBe("cuenta_bloqueada");
  });

  it("frena al pasar el tope del espacio, sea cual sea la llave", async () => {
    base({ api_ajustes: [{ workspace_id: "w1", limite_por_minuto: 2 }] });
    expect("ctx" in (await autenticar(peticion(), null))).toBe(true);
    expect("ctx" in (await autenticar(peticion(), null))).toBe(true);
    const tercera = await autenticar(peticion(), null);
    expect("respuesta" in tercera && tercera.respuesta.status).toBe(429);
    expect("respuesta" in tercera && tercera.respuesta.headers.get("retry-after")).toBeTruthy();
  });

  it("guarda la huella, nunca la llave, y deja el registro de la llamada", async () => {
    expect(llave.huella).toBe(huellaDe(llave.llave));
    const r = await conApi(peticion(), "contactos:leer", async () => new Response("{}", { status: 200 }));
    expect(r.status).toBe(200);
    await new Promise((res) => setTimeout(res, 0));
    const uso = escrituras.find((e) => e.tabla === "api_uso");
    expect(uso?.datos).toMatchObject({ workspace_id: "w1", llave_id: "k1", metodo: "GET", estado: 200 });
    expect(JSON.stringify(escrituras)).not.toContain(llave.llave);
  });

  it("un error inesperado en la ruta no se filtra: sale como error_interno", async () => {
    const r = await conApi(peticion(), "contactos:leer", async () => {
      throw new Error("detalle interno secreto");
    });
    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toContain("secreto");
  });
});

describe("enviarMensajeApi (validaciones antes de tocar WhatsApp)", () => {
  beforeEach(() => base());
  const admin = () => falsa() as unknown as Parameters<typeof enviarMensajeApi>[0];

  it("exige texto o plantilla, pero no ambos", async () => {
    const ninguno = await enviarMensajeApi(admin(), "w1", { telefono: "573001234567" });
    expect(ninguno).toMatchObject({ ok: false, codigo: "peticion_invalida" });
    const ambos = await enviarMensajeApi(admin(), "w1", { telefono: "573001234567", texto: "hola", plantilla: { nombre: "x" } });
    expect(ambos).toMatchObject({ ok: false, codigo: "peticion_invalida" });
  });

  it("rechaza un teléfono inválido y un contacto que no es del espacio", async () => {
    expect(await enviarMensajeApi(admin(), "w1", { telefono: "12", texto: "hola" })).toMatchObject({ ok: false, codigo: "peticion_invalida" });
    tablas.contacts = [];
    expect(await enviarMensajeApi(admin(), "w1", { contacto_id: "no-existe", texto: "hola" })).toMatchObject({ ok: false, codigo: "no_encontrado" });
  });
});
