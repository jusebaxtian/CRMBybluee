import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock se eleva por encima del resto del archivo, asi que lo que use su
// fabrica tiene que declararse con vi.hoisted para existir a tiempo.
const mocks = vi.hoisted(() => ({
  executeCampaignSend: vi.fn(async () => ({ success: true as const })),
  clienteActual: { valor: null as unknown },
}));
const executeCampaignSend = mocks.executeCampaignSend;

vi.mock("@/lib/campaigns/send", () => ({ executeCampaignSend: mocks.executeCampaignSend }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => mocks.clienteActual.valor }));

let cliente: ReturnType<typeof fakeSupabase>;
/** Deja el doble listo para que createAdminClient lo devuelva. */
function usarCliente(c: ReturnType<typeof fakeSupabase>) {
  cliente = c;
  mocks.clienteActual.valor = c;
}

import { processDueCampaigns } from "@/lib/campaigns/scheduler";

type Estado = {
  borradoresVencidos?: { id: string; workspace_id: string }[];
  enviandoEstancadas?: { id: string; workspace_id: string }[];
  /** Si el reclamo devuelve fila. false simula que otro tick gano la carrera. */
  reclamoExitoso?: boolean;
  pendientes?: number;
  fallidos?: number;
  total?: number;
};

/**
 * Doble de Supabase que entiende las cadenas que usa el planificador.
 *
 * Las consultas de lista se resuelven al await (thenable); las de reclamo
 * terminan en maybeSingle(); las de conteo devuelven `count`. Registra cada
 * operacion para poder afirmar sobre lo que se escribio.
 */
function fakeSupabase(estado: Estado) {
  const escrituras: { tabla: string; cambios: Record<string, unknown> }[] = [];

  return {
    escrituras,
    from(tabla: string) {
      let esUpdate = false;
      let cambios: Record<string, unknown> = {};
      let filtroEstado: string | undefined;
      let conteoDe: string | undefined;
      let pideConteo = false;

      const ctx: Record<string, unknown> = {
        select: (_cols?: string, opts?: { count?: string; head?: boolean }) => {
          if (opts?.count) pideConteo = true;
          return ctx;
        },
        update: (c: Record<string, unknown>) => {
          esUpdate = true;
          cambios = c;
          return ctx;
        },
        eq: (col: string, val: unknown) => {
          if (col === "status") {
            if (tabla === "campaigns") filtroEstado = String(val);
            else conteoDe = String(val);
          }
          return ctx;
        },
        not: () => ctx,
        lte: () => ctx,
        lt: () => ctx,
        maybeSingle: async () => {
          if (esUpdate) {
            const ok = estado.reclamoExitoso !== false;
            if (ok) escrituras.push({ tabla, cambios });
            return { data: ok ? { id: "x" } : null };
          }
          return { data: null };
        },
        then: (resolver: (v: unknown) => unknown) => {
          if (pideConteo) {
            const n =
              conteoDe === "pending"
                ? (estado.pendientes ?? 0)
                : conteoDe === "failed"
                  ? (estado.fallidos ?? 0)
                  : (estado.total ?? 0);
            return Promise.resolve({ count: n }).then(resolver);
          }
          if (esUpdate) {
            escrituras.push({ tabla, cambios });
            return Promise.resolve({ data: null }).then(resolver);
          }
          const filas =
            filtroEstado === "draft"
              ? (estado.borradoresVencidos ?? [])
              : filtroEstado === "sending"
                ? (estado.enviandoEstancadas ?? [])
                : [];
          return Promise.resolve({ data: filas }).then(resolver);
        },
      };
      return ctx;
    },
  };
}

beforeEach(() => {
  executeCampaignSend.mockClear();
});

describe("processDueCampaigns — arrancar programadas", () => {
  it("envía una campaña programada cuya hora llegó", async () => {
    usarCliente(fakeSupabase({ borradoresVencidos: [{ id: "c1", workspace_id: "ws1" }] }));
    await processDueCampaigns();
    expect(executeCampaignSend).toHaveBeenCalledTimes(1);
  });

  it("marca el latido al reclamarla, no solo el estado", async () => {
    usarCliente(fakeSupabase({ borradoresVencidos: [{ id: "c1", workspace_id: "ws1" }] }));
    await processDueCampaigns();

    const reclamo = cliente.escrituras.find((e) => e.cambios.status === "sending");
    expect(reclamo?.cambios.last_progress_at).toBeTruthy();
  });

  it("no envía si otro tick ganó el reclamo", async () => {
    usarCliente(fakeSupabase({
      borradoresVencidos: [{ id: "c1", workspace_id: "ws1" }],
      reclamoExitoso: false,
    }));
    await processDueCampaigns();
    expect(executeCampaignSend).not.toHaveBeenCalled();
  });

  it("no hace nada si no hay campañas vencidas", async () => {
    usarCliente(fakeSupabase({}));
    await processDueCampaigns();
    expect(executeCampaignSend).not.toHaveBeenCalled();
  });
});

describe("processDueCampaigns — reanudar estancadas", () => {
  it("reanuda una campaña muerta que aún tiene pendientes", async () => {
    usarCliente(fakeSupabase({
      enviandoEstancadas: [{ id: "c9", workspace_id: "ws1" }],
      pendientes: 120,
    }));
    await processDueCampaigns();
    expect(executeCampaignSend).toHaveBeenCalledTimes(1);
  });

  it("SEGURIDAD: no reanuda si otro tick ya la reclamó — evita enviar dos veces", async () => {
    usarCliente(fakeSupabase({
      enviandoEstancadas: [{ id: "c9", workspace_id: "ws1" }],
      pendientes: 120,
      reclamoExitoso: false,
    }));
    await processDueCampaigns();
    expect(executeCampaignSend).not.toHaveBeenCalled();
  });

  it("cierra como completada la que murió sin pendientes, sin reenviar nada", async () => {
    usarCliente(fakeSupabase({
      enviandoEstancadas: [{ id: "c9", workspace_id: "ws1" }],
      pendientes: 0,
      fallidos: 2,
      total: 50,
    }));
    await processDueCampaigns();

    expect(executeCampaignSend).not.toHaveBeenCalled();
    expect(cliente.escrituras.some((e) => e.cambios.status === "completed")).toBe(true);
  });

  it("la marca como fallida si todos sus destinatarios fallaron", async () => {
    usarCliente(fakeSupabase({
      enviandoEstancadas: [{ id: "c9", workspace_id: "ws1" }],
      pendientes: 0,
      fallidos: 50,
      total: 50,
    }));
    await processDueCampaigns();
    expect(cliente.escrituras.some((e) => e.cambios.status === "failed")).toBe(true);
  });

  it("no toca nada cuando ninguna campaña está estancada", async () => {
    usarCliente(fakeSupabase({ enviandoEstancadas: [] }));
    await processDueCampaigns();
    expect(executeCampaignSend).not.toHaveBeenCalled();
  });
});
