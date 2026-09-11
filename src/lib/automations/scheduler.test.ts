import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * SEGURIDAD — el reclamo de tareas vencidas ante dos procesos.
 *
 * La Fase 4 saca los trabajos de fondo a un proceso aparte, asi que a partir
 * de ahi puede haber dos ticks corriendo a la vez. El reclamo antiguo borraba
 * la fila y solo miraba el error: un DELETE que no encuentra nada devuelve
 * error nulo, asi que los dos procesos creian haberla reclamado y el contacto
 * recibia el mensaje dos veces.
 *
 * Estas pruebas corren dos ticks sobre la misma tarea y exigen que solo uno
 * reanude la automatizacion.
 */

const { createAdminClient, resumeAutomationRun, isContactExcludedFromFollowups } = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  resumeAutomationRun: vi.fn(),
  isContactExcludedFromFollowups: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/automations/engine", () => ({ resumeAutomationRun, isContactExcludedFromFollowups }));

import { processDueAutomationRuns } from "@/lib/automations/scheduler";

type Tarea = {
  id: string;
  workspace_id: string;
  automation_id: string;
  contact_id: string;
  next_position: number;
  automations: { trigger_type: string } | null;
};

function tarea(id: string, triggerType = "keyword"): Tarea {
  return {
    id,
    workspace_id: "ws-1",
    automation_id: "auto-1",
    contact_id: `contacto-${id}`,
    next_position: 2,
    automations: { trigger_type: triggerType },
  };
}

/**
 * Base compartida por los dos ticks. `pendientes` es el estado real: el primer
 * borrado se lleva la fila y devuelve una; el segundo no encuentra nada y
 * devuelve null, que es exactamente lo que hace PostgREST.
 */
function baseCompartida(tareas: Tarea[]) {
  const pendientes = new Set(tareas.map((t) => t.id));

  function cliente() {
    return {
      from(tabla: string) {
        if (tabla === "automation_pending_runs") {
          const lectura = {
            select: () => lectura,
            eq: () => lectura,
            lte: () => lectura,
            // Cada tick lee la lista completa: ninguno sabe del otro.
            limit: async () => ({ data: tareas }),
          };
          return {
            ...lectura,
            delete: () => {
              let objetivo: string | null = null;
              const cadena = {
                eq: (_columna: string, valor: string) => {
                  objetivo = valor;
                  return cadena;
                },
                select: () => cadena,
                maybeSingle: async () => {
                  if (objetivo && pendientes.delete(objetivo)) {
                    return { data: { id: objetivo }, error: null };
                  }
                  return { data: null, error: null };
                },
              };
              return cadena;
            },
          };
        }

        // automation_reply_waits: borrado sin retorno.
        const cadena: Record<string, unknown> = {
          delete: () => cadena,
          eq: () => cadena,
          then: (resolver: (v: unknown) => unknown) =>
            Promise.resolve({ error: null }).then(resolver),
        };
        return cadena;
      },
    };
  }

  return { cliente, pendientes };
}

beforeEach(() => {
  vi.clearAllMocks();
  isContactExcludedFromFollowups.mockResolvedValue(false);
  resumeAutomationRun.mockResolvedValue(undefined);
});

describe("processDueAutomationRuns — dos procesos sobre la misma tarea", () => {
  it("solo uno de los dos ticks reanuda la automatizacion", async () => {
    const { cliente } = baseCompartida([tarea("t1")]);
    createAdminClient.mockImplementation(cliente);

    await Promise.all([processDueAutomationRuns(), processDueAutomationRuns()]);

    // Si el reclamo no comprobara la fila borrada, serian dos.
    expect(resumeAutomationRun).toHaveBeenCalledTimes(1);
  });

  it("con varias tareas, cada una se reanuda exactamente una vez", async () => {
    const { cliente } = baseCompartida([tarea("t1"), tarea("t2"), tarea("t3")]);
    createAdminClient.mockImplementation(cliente);

    await Promise.all([processDueAutomationRuns(), processDueAutomationRuns()]);

    expect(resumeAutomationRun).toHaveBeenCalledTimes(3);
    const contactos = resumeAutomationRun.mock.calls.map((c) => c[2]).sort();
    expect(contactos).toEqual(["contacto-t1", "contacto-t2", "contacto-t3"]);
  });

  it("un tick solo sigue reanudando con normalidad", async () => {
    const { cliente } = baseCompartida([tarea("t1"), tarea("t2")]);
    createAdminClient.mockImplementation(cliente);

    await processDueAutomationRuns();

    expect(resumeAutomationRun).toHaveBeenCalledTimes(2);
  });

  it("deja la tabla vacia: nada queda reclamado a medias", async () => {
    const { cliente, pendientes } = baseCompartida([tarea("t1"), tarea("t2")]);
    createAdminClient.mockImplementation(cliente);

    await Promise.all([processDueAutomationRuns(), processDueAutomationRuns()]);

    expect(pendientes.size).toBe(0);
  });
});

describe("la exclusion se comprueba despues de reclamar", () => {
  it("no reanuda un no_reply cuyo contacto quedo excluido durante la espera", async () => {
    // Una etiqueta "ya compro" puede llegar en cualquier momento de la espera.
    const { cliente } = baseCompartida([tarea("t1", "no_reply")]);
    createAdminClient.mockImplementation(cliente);
    isContactExcludedFromFollowups.mockResolvedValue(true);

    await processDueAutomationRuns();

    expect(resumeAutomationRun).not.toHaveBeenCalled();
  });

  it("la exclusion no frena a un disparador que no sea no_reply", async () => {
    const { cliente } = baseCompartida([tarea("t1", "keyword")]);
    createAdminClient.mockImplementation(cliente);
    isContactExcludedFromFollowups.mockResolvedValue(true);

    await processDueAutomationRuns();

    expect(resumeAutomationRun).toHaveBeenCalledTimes(1);
  });
});
