import { describe, it, expect, vi, beforeEach } from "vitest";

// getWorkspaceId lee la cookie de suplantacion vía next/headers, que fuera de
// una peticion real no existe. Se reemplaza por un doble controlable.
const cookieStore = { get: vi.fn() };
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve(cookieStore),
}));

import { getWorkspaceId, getWorkspaceRole, IMPERSONATION_COOKIE } from "@/lib/workspace";

/**
 * Doble del cliente de Supabase con lo justo que usan estas funciones:
 * `rpc` (para is_platform_admin), `auth.getUser` y la cadena de consulta
 * `from().select().eq()...maybeSingle()`.
 *
 * La cadena devuelve `this` en cada eslabon para poder encadenar en cualquier
 * orden, y `maybeSingle()` resuelve lo que se le haya configurado.
 */
function fakeSupabase(opts: {
  esAdminDePlataforma?: boolean;
  usuario?: { id: string } | null;
  filaConsultada?: Record<string, unknown> | null;
}) {
  const consultas: { tabla: string; filtros: Record<string, unknown> }[] = [];

  const cliente = {
    rpc: vi.fn(async () => ({ data: opts.esAdminDePlataforma === true })),
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: opts.usuario === undefined ? { id: "user-1" } : opts.usuario },
      })),
    },
    from(tabla: string) {
      const registro = { tabla, filtros: {} as Record<string, unknown> };
      consultas.push(registro);
      const constructor = {
        select: () => constructor,
        eq: (columna: string, valor: unknown) => {
          registro.filtros[columna] = valor;
          return constructor;
        },
        limit: () => constructor,
        maybeSingle: async () => ({ data: opts.filaConsultada ?? null }),
      };
      return constructor;
    },
    consultas,
  };

  return cliente as unknown as Parameters<typeof getWorkspaceId>[0] & { consultas: typeof consultas };
}

beforeEach(() => {
  cookieStore.get.mockReset();
  cookieStore.get.mockReturnValue(undefined);
});

describe("getWorkspaceId — resolucion del espacio de trabajo", () => {
  it("devuelve el espacio del que el usuario es miembro", async () => {
    const supabase = fakeSupabase({
      usuario: { id: "user-1" },
      filaConsultada: { workspace_id: "ws-propio" },
    });

    await expect(getWorkspaceId(supabase)).resolves.toBe("ws-propio");
  });

  it("filtra la membresia por el id del usuario autenticado", async () => {
    const supabase = fakeSupabase({
      usuario: { id: "user-42" },
      filaConsultada: { workspace_id: "ws-propio" },
    });

    await getWorkspaceId(supabase);

    const consulta = supabase.consultas.find((c) => c.tabla === "workspace_members");
    expect(consulta?.filtros.user_id).toBe("user-42");
  });

  it("devuelve null si no hay sesion", async () => {
    const supabase = fakeSupabase({ usuario: null });
    await expect(getWorkspaceId(supabase)).resolves.toBeNull();
  });

  it("devuelve null si el usuario no pertenece a ningun espacio", async () => {
    const supabase = fakeSupabase({ usuario: { id: "user-1" }, filaConsultada: null });
    await expect(getWorkspaceId(supabase)).resolves.toBeNull();
  });
});

describe("getWorkspaceId — suplantacion (modo soporte)", () => {
  it("un admin de plataforma con la cookie puesta obtiene el espacio suplantado", async () => {
    cookieStore.get.mockImplementation((nombre: string) =>
      nombre === IMPERSONATION_COOKIE ? { value: "ws-del-cliente" } : undefined
    );
    const supabase = fakeSupabase({
      esAdminDePlataforma: true,
      usuario: { id: "admin-1" },
      filaConsultada: { workspace_id: "ws-propio-del-admin" },
    });

    await expect(getWorkspaceId(supabase)).resolves.toBe("ws-del-cliente");
  });

  it("SEGURIDAD: quien no es admin de plataforma NO accede al espacio ajeno aunque falsifique la cookie", async () => {
    cookieStore.get.mockImplementation((nombre: string) =>
      nombre === IMPERSONATION_COOKIE ? { value: "ws-de-otro-cliente" } : undefined
    );
    const supabase = fakeSupabase({
      esAdminDePlataforma: false,
      usuario: { id: "usuario-cualquiera" },
      filaConsultada: { workspace_id: "ws-propio" },
    });

    // Cae al camino normal: su propio espacio, nunca el de la cookie.
    await expect(getWorkspaceId(supabase)).resolves.toBe("ws-propio");
  });

  it("SEGURIDAD: cookie falsificada sin sesion tampoco da acceso", async () => {
    cookieStore.get.mockImplementation((nombre: string) =>
      nombre === IMPERSONATION_COOKIE ? { value: "ws-de-otro-cliente" } : undefined
    );
    const supabase = fakeSupabase({ esAdminDePlataforma: false, usuario: null });

    await expect(getWorkspaceId(supabase)).resolves.toBeNull();
  });
});

describe("getWorkspaceRole — rol dentro del espacio", () => {
  it("devuelve null cuando no hay espacio", async () => {
    const supabase = fakeSupabase({ usuario: { id: "user-1" } });
    await expect(getWorkspaceRole(supabase, null)).resolves.toBeNull();
  });

  it("devuelve el rol del miembro", async () => {
    const supabase = fakeSupabase({
      usuario: { id: "user-1" },
      filaConsultada: { role: "agent" },
    });
    await expect(getWorkspaceRole(supabase, "ws-1")).resolves.toBe("agent");
  });

  it("devuelve null si el usuario no es miembro de ese espacio", async () => {
    const supabase = fakeSupabase({ usuario: { id: "user-1" }, filaConsultada: null });
    await expect(getWorkspaceRole(supabase, "ws-1")).resolves.toBeNull();
  });

  it("un admin suplantando ESE espacio obtiene rol owner aunque no sea miembro", async () => {
    cookieStore.get.mockImplementation((nombre: string) =>
      nombre === IMPERSONATION_COOKIE ? { value: "ws-1" } : undefined
    );
    const supabase = fakeSupabase({
      esAdminDePlataforma: true,
      usuario: { id: "admin-1" },
      filaConsultada: null,
    });

    await expect(getWorkspaceRole(supabase, "ws-1")).resolves.toBe("owner");
  });

  it("SEGURIDAD: la suplantacion de un espacio no concede rol en OTRO espacio", async () => {
    cookieStore.get.mockImplementation((nombre: string) =>
      nombre === IMPERSONATION_COOKIE ? { value: "ws-1" } : undefined
    );
    const supabase = fakeSupabase({
      esAdminDePlataforma: true,
      usuario: { id: "admin-1" },
      filaConsultada: null,
    });

    // Pide el rol en ws-2 mientras suplanta ws-1: no debe heredar owner.
    await expect(getWorkspaceRole(supabase, "ws-2")).resolves.toBeNull();
  });

  it("SEGURIDAD: quien no es admin no obtiene owner por poner la cookie", async () => {
    cookieStore.get.mockImplementation((nombre: string) =>
      nombre === IMPERSONATION_COOKIE ? { value: "ws-1" } : undefined
    );
    const supabase = fakeSupabase({
      esAdminDePlataforma: false,
      usuario: { id: "usuario-cualquiera" },
      filaConsultada: null,
    });

    await expect(getWorkspaceRole(supabase, "ws-1")).resolves.toBeNull();
  });
});
