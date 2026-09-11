import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * SEGURIDAD — aislamiento entre inquilinos en las acciones de etiquetas.
 *
 * Estas cuatro acciones filtraban solo por `id` y se apoyaban en RLS. Para las
 * tablas con `workspace_id` propio (tags) RLS alcanzaba, pero `contact_tags`
 * no: su politica valida el contacto y nada mas, asi que con el UUID de una
 * etiqueta ajena se le podia pegar a un contacto propio.
 *
 * Lo que se prueba aqui es que el filtro por espacio de trabajo esta puesto,
 * no que RLS funcione. Si alguien quita un `.eq("workspace_id", ...)`, estas
 * pruebas fallan aunque la base siga protegida.
 */

const { requireWorkspace, runTagAddedAutomations, maybeTrackPurchaseFromTag } = vi.hoisted(() => ({
  requireWorkspace: vi.fn(),
  runTagAddedAutomations: vi.fn(),
  maybeTrackPurchaseFromTag: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/with-workspace", () => ({ requireWorkspace }));
vi.mock("@/lib/automations/engine", () => ({ runTagAddedAutomations }));
vi.mock("@/lib/meta/conversions", () => ({ maybeTrackPurchaseFromTag }));

import {
  toggleTagExcludesFollowups,
  toggleTagMarksPurchase,
  deleteTag,
  toggleContactTag,
} from "@/app/actions/tags";

const MI_ESPACIO = "ws-propio";

type Filtro = [string, unknown];
type Llamada = { tabla: string; operacion: string; filtros: Filtro[] };

/**
 * Doble de Supabase que anota cada consulta y sus filtros, para poder afirmar
 * que `workspace_id` aparece entre ellos. `etiquetaEncontrada` decide que
 * devuelve el maybeSingle con el que toggleContactTag comprueba la etiqueta:
 * null representa "esa etiqueta no es de este espacio".
 */
function espiarSupabase(opciones: { etiquetaEncontrada?: boolean } = {}) {
  const llamadas: Llamada[] = [];

  function cadena(tabla: string, operacion: string) {
    const llamada: Llamada = { tabla, operacion, filtros: [] };
    llamadas.push(llamada);
    const constructor: Record<string, unknown> = {
      select: () => constructor,
      eq: (columna: string, valor: unknown) => {
        llamada.filtros.push([columna, valor]);
        return constructor;
      },
      maybeSingle: async () => ({
        data: opciones.etiquetaEncontrada === false ? null : { id: "tag-1" },
      }),
      then: (resolver: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(resolver),
    };
    return constructor;
  }

  const supabase = {
    from(tabla: string) {
      return {
        update: () => cadena(tabla, "update"),
        delete: () => cadena(tabla, "delete"),
        insert: (fila: unknown) => {
          llamadas.push({ tabla, operacion: "insert", filtros: Object.entries(fila as object) });
          return Promise.resolve({ error: null });
        },
        select: () => cadena(tabla, "select"),
      };
    },
  };

  return { supabase, llamadas };
}

function filtroDeEspacio(llamada: Llamada) {
  return llamada.filtros.find(([columna]) => columna === "workspace_id");
}

beforeEach(() => {
  vi.clearAllMocks();
});

function conEspacio(opciones: { etiquetaEncontrada?: boolean } = {}) {
  const espia = espiarSupabase(opciones);
  requireWorkspace.mockResolvedValue({ supabase: espia.supabase, workspaceId: MI_ESPACIO });
  return espia;
}

function sinEspacio() {
  const espia = espiarSupabase();
  requireWorkspace.mockResolvedValue({ error: "No se encontró tu workspace." });
  return espia;
}

describe("toggleTagExcludesFollowups — la marca que apaga las automatizaciones", () => {
  it("solo toca etiquetas del espacio propio", async () => {
    const { llamadas } = conEspacio();
    await toggleTagExcludesFollowups("tag-ajena", true);

    const update = llamadas.find((l) => l.operacion === "update")!;
    expect(update.tabla).toBe("tags");
    expect(filtroDeEspacio(update)).toEqual(["workspace_id", MI_ESPACIO]);
  });

  it("no escribe nada sin espacio de trabajo", async () => {
    const { llamadas } = sinEspacio();
    await expect(toggleTagExcludesFollowups("tag-1", true)).resolves.toEqual({
      error: "No se encontró tu workspace.",
    });
    expect(llamadas).toHaveLength(0);
  });
});

describe("toggleTagMarksPurchase — la marca que reporta compras a Meta", () => {
  it("solo toca etiquetas del espacio propio", async () => {
    const { llamadas } = conEspacio();
    await toggleTagMarksPurchase("tag-ajena", true);

    const update = llamadas.find((l) => l.operacion === "update")!;
    expect(filtroDeEspacio(update)).toEqual(["workspace_id", MI_ESPACIO]);
  });

  it("no escribe nada sin espacio de trabajo", async () => {
    const { llamadas } = sinEspacio();
    await toggleTagMarksPurchase("tag-1", true);
    expect(llamadas).toHaveLength(0);
  });
});

describe("deleteTag — borrado definitivo", () => {
  it("solo borra etiquetas del espacio propio", async () => {
    const { llamadas } = conEspacio();
    await deleteTag("tag-ajena");

    const borrado = llamadas.find((l) => l.operacion === "delete")!;
    expect(borrado.tabla).toBe("tags");
    expect(filtroDeEspacio(borrado)).toEqual(["workspace_id", MI_ESPACIO]);
  });

  it("no borra nada sin espacio de trabajo", async () => {
    const { llamadas } = sinEspacio();
    await deleteTag("tag-1");
    expect(llamadas).toHaveLength(0);
  });
});

describe("toggleContactTag — el hueco que RLS no cubre", () => {
  it("comprueba que la etiqueta sea del espacio antes de asignarla", async () => {
    const { llamadas } = conEspacio({ etiquetaEncontrada: true });
    await toggleContactTag({ contactId: "c1", tagId: "tag-1", assign: true });

    const comprobacion = llamadas.find((l) => l.tabla === "tags")!;
    expect(filtroDeEspacio(comprobacion)).toEqual(["workspace_id", MI_ESPACIO]);
    expect(llamadas.some((l) => l.tabla === "contact_tags" && l.operacion === "insert")).toBe(true);
  });

  it("no asigna una etiqueta de otro espacio", async () => {
    const { llamadas } = conEspacio({ etiquetaEncontrada: false });
    await toggleContactTag({ contactId: "c1", tagId: "tag-ajena", assign: true });

    expect(llamadas.some((l) => l.tabla === "contact_tags")).toBe(false);
  });

  it("tampoco dispara las automatizaciones con una etiqueta ajena", async () => {
    conEspacio({ etiquetaEncontrada: false });
    await toggleContactTag({ contactId: "c1", tagId: "tag-ajena", assign: true });

    expect(runTagAddedAutomations).not.toHaveBeenCalled();
    expect(maybeTrackPurchaseFromTag).not.toHaveBeenCalled();
  });

  it("dispara las automatizaciones con el espacio propio, nunca con otro", async () => {
    conEspacio({ etiquetaEncontrada: true });
    await toggleContactTag({ contactId: "c1", tagId: "tag-1", assign: true });

    expect(runTagAddedAutomations).toHaveBeenCalledWith(
      expect.anything(),
      MI_ESPACIO,
      "c1",
      "tag-1"
    );
  });

  it("tampoco deja quitar una etiqueta de otro espacio", async () => {
    const { llamadas } = conEspacio({ etiquetaEncontrada: false });
    await toggleContactTag({ contactId: "c1", tagId: "tag-ajena", assign: false });

    expect(llamadas.some((l) => l.tabla === "contact_tags")).toBe(false);
  });

  it("no escribe nada sin espacio de trabajo", async () => {
    const { llamadas } = sinEspacio();
    await toggleContactTag({ contactId: "c1", tagId: "tag-1", assign: true });
    expect(llamadas).toHaveLength(0);
  });
});
