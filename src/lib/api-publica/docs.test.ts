import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { ENDPOINTS, openApi, coleccionPostman, ejemploCurl, ejemploJs, ejemploPython } from "@/lib/api-publica/docs";
import { PERMISOS } from "@/lib/api-publica/permisos";

const RAIZ = path.join(process.cwd(), "src", "app", "api", "v1");

function rutasDeArchivos(dir: string, base = ""): { metodo: string; ruta: string; permiso: string | null }[] {
  const salida: { metodo: string; ruta: string; permiso: string | null }[] = [];
  for (const nombre of readdirSync(dir)) {
    const completo = path.join(dir, nombre);
    if (statSync(completo).isDirectory()) {
      salida.push(...rutasDeArchivos(completo, `${base}/${nombre.replace(/^\[(.+)\]$/, "{$1}")}`));
    } else if (nombre === "route.ts") {
      const fuente = readFileSync(completo, "utf8");
      const trozos = fuente.split(/export async function /).slice(1);
      for (const t of trozos) {
        const metodo = t.slice(0, t.indexOf("("));
        const permiso = /conApi\(\s*request,\s*(null|"([^"]+)")/.exec(t);
        salida.push({ metodo, ruta: base === "" ? "/" : base, permiso: permiso?.[2] ?? null });
      }
    }
  }
  return salida;
}

describe("documentación de la API", () => {
  const reales = rutasDeArchivos(RAIZ);

  it("cada ruta existente está documentada, con su mismo permiso", () => {
    expect(reales.length).toBeGreaterThan(15);
    for (const r of reales) {
      const doc = ENDPOINTS.find((e) => e.metodo === r.metodo && e.ruta === r.ruta);
      expect(doc, `${r.metodo} ${r.ruta} no está en docs.ts`).toBeDefined();
      expect(doc?.permiso, `permiso de ${r.metodo} ${r.ruta}`).toBe(r.permiso);
    }
  });

  it("no documenta rutas que no existen", () => {
    for (const e of ENDPOINTS) {
      expect(reales.some((r) => r.metodo === e.metodo && r.ruta === e.ruta), `${e.metodo} ${e.ruta} no existe`).toBe(true);
    }
  });

  it("todos los permisos documentados existen, y todos se usan", () => {
    const validos = new Set<string>(PERMISOS.map((p) => p.clave));
    for (const e of ENDPOINTS) if (e.permiso) expect(validos.has(e.permiso), e.permiso).toBe(true);
    for (const p of PERMISOS) expect(ENDPOINTS.some((e) => e.permiso === p.clave), `ningún endpoint usa ${p.clave}`).toBe(true);
  });

  it("los ids son únicos", () => {
    expect(new Set(ENDPOINTS.map((e) => e.id)).size).toBe(ENDPOINTS.length);
  });

  it("genera ejemplos, OpenAPI y Postman sin romperse", () => {
    for (const e of ENDPOINTS) {
      expect(ejemploCurl(e)).toContain("Authorization: Bearer");
      expect(ejemploJs(e)).toContain("fetch(");
      expect(ejemploPython(e)).toContain("requests.");
    }
    const spec = openApi() as { paths: Record<string, unknown>; openapi: string };
    expect(spec.openapi).toBe("3.0.3");
    expect(Object.keys(spec.paths)).toContain("/mensajes");
    expect(() => JSON.stringify(coleccionPostman())).not.toThrow();
  });

  it("el ejemplo de Python usa True/False/None", () => {
    const e = ENDPOINTS.find((x) => x.id === "enviar-mensaje")!;
    expect(ejemploPython({ ...e, ejemploCuerpo: { a: true, b: null } })).toContain("True");
  });
});
