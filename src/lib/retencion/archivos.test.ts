import { describe, it, expect } from "vitest";
import { eliminarArchivosDelWorkspace } from "@/lib/retencion/archivos";
import { POLITICA_RETENCION, corteDe } from "@/lib/retencion/politica";

/**
 * El borrado de un espacio prometia llevarse los archivos y no lo hacia: el
 * ON DELETE CASCADE de Postgres no alcanza a `storage`. Resultado medido el 11
 * de septiembre de 2026: diez objetos en un bucket publico pertenecientes a
 * espacios que ya no existian.
 */

type Entrada = { name: string; id: string | null };

/**
 * Doble de storage. `arbol` describe que devuelve list() para cada prefijo;
 * una entrada con id null es una carpeta, que es como Supabase las marca.
 */
function espiarStorage(
  arbol: Record<string, Entrada[]>,
  fallos: Record<string, string> = {}
) {
  const borrados: string[] = [];
  const listados: string[] = [];

  const admin = {
    storage: {
      from(bucket: string) {
        return {
          list: async (prefijo: string) => {
            listados.push(`${bucket}:${prefijo}`);
            if (fallos[`list:${bucket}`]) return { data: null, error: { message: fallos[`list:${bucket}`] } };
            return { data: arbol[`${bucket}:${prefijo}`] ?? [], error: null };
          },
          remove: async (rutas: string[]) => {
            if (fallos[`remove:${bucket}`]) return { error: { message: fallos[`remove:${bucket}`] } };
            borrados.push(...rutas.map((r) => `${bucket}:${r}`));
            return { error: null };
          },
        };
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  return { admin, borrados, listados };
}

const WS = "ws-1";

describe("eliminarArchivosDelWorkspace", () => {
  it("baja por las carpetas: list() no es recursivo", async () => {
    // chat-media anida <espacio>/<conversacion>/<archivo>. Si solo se mirara
    // el primer nivel, se borrarian cero archivos y nadie lo notaria.
    const { admin, borrados } = espiarStorage({
      "chat-media:ws-1": [{ name: "conv-a", id: null }, { name: "suelto.jpg", id: "1" }],
      "chat-media:ws-1/conv-a": [{ name: "audio.ogg", id: "2" }, { name: "foto.jpg", id: "3" }],
      "payment-proofs:ws-1": [],
    });

    const r = await eliminarArchivosDelWorkspace(admin, WS);

    expect(r.borrados).toBe(3);
    expect(borrados).toEqual(
      expect.arrayContaining([
        "chat-media:ws-1/suelto.jpg",
        "chat-media:ws-1/conv-a/audio.ogg",
        "chat-media:ws-1/conv-a/foto.jpg",
      ])
    );
  });

  it("tambien limpia los comprobantes de pago", async () => {
    const { admin, borrados } = espiarStorage({
      "chat-media:ws-1": [],
      "payment-proofs:ws-1": [{ name: "comprobante.pdf", id: "9" }],
    });

    await eliminarArchivosDelWorkspace(admin, WS);
    expect(borrados).toContain("payment-proofs:ws-1/comprobante.pdf");
  });

  it("no toca el bucket de banners, que es de la plataforma", async () => {
    const { admin, listados } = espiarStorage({ "chat-media:ws-1": [], "payment-proofs:ws-1": [] });
    await eliminarArchivosDelWorkspace(admin, WS);
    expect(listados.some((l) => l.startsWith("banners:"))).toBe(false);
  });

  it("trocea el borrado en lotes de cien", async () => {
    const muchos = Array.from({ length: 250 }, (_, i) => ({ name: `f${i}.jpg`, id: String(i) }));
    const { admin, borrados } = espiarStorage({
      "chat-media:ws-1": muchos,
      "payment-proofs:ws-1": [],
    });

    const r = await eliminarArchivosDelWorkspace(admin, WS);
    expect(r.borrados).toBe(250);
    expect(borrados).toHaveLength(250);
  });

  it("recoge el error del listado en vez de darlo por hecho", async () => {
    const { admin } = espiarStorage({}, { "list:chat-media": "sin permiso" });
    const r = await eliminarArchivosDelWorkspace(admin, WS);
    expect(r.errores[0]).toContain("sin permiso");
  });

  it("recoge el error del borrado", async () => {
    const { admin } = espiarStorage(
      { "chat-media:ws-1": [{ name: "a.jpg", id: "1" }], "payment-proofs:ws-1": [] },
      { "remove:chat-media": "fallo de red" }
    );
    const r = await eliminarArchivosDelWorkspace(admin, WS);
    expect(r.borrados).toBe(0);
    expect(r.errores[0]).toContain("fallo de red");
  });

  it("un espacio sin archivos no es un error", async () => {
    const { admin } = espiarStorage({ "chat-media:ws-1": [], "payment-proofs:ws-1": [] });
    await expect(eliminarArchivosDelWorkspace(admin, WS)).resolves.toEqual({
      borrados: 0,
      errores: [],
    });
  });
});

describe("politica de retencion", () => {
  it("guarda los plazos acordados", () => {
    expect(POLITICA_RETENCION.mensajes.meses).toBe(24);
    expect(POLITICA_RETENCION.multimedia.meses).toBe(12);
    expect(POLITICA_RETENCION.contactosInactivos.meses).toBe(12);
    expect(POLITICA_RETENCION.registros.meses).toBe(6);
  });

  it("la fecha de corte retrocede los meses de la regla", () => {
    const ahora = new Date("2026-09-11T00:00:00Z");
    expect(corteDe(POLITICA_RETENCION.mensajes, ahora).getUTCFullYear()).toBe(2024);
    expect(corteDe(POLITICA_RETENCION.registros, ahora).getUTCMonth()).toBe(2); // marzo
  });
});
