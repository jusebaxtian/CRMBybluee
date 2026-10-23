import { describe, it, expect } from "vitest";
import { ejecutarRespuestaRapida, planificarRespuestaRapida } from "@/lib/automations/engine";

const a = (position: number, delay_seconds: number) => ({ position, delay_seconds });

describe("planificarRespuestaRapida — las esperas de cada mensaje", () => {
  it("sin esperas, todo sale ahora", () => {
    const r = planificarRespuestaRapida([a(0, 0), a(1, 0), a(2, 0)]);
    expect(r.ahora.map((x) => x.position)).toEqual([0, 1, 2]);
    expect(r.despues).toBeNull();
  });

  it("el caso Demo-Video: el primero sale ya y el segundo espera 5 minutos", () => {
    const r = planificarRespuestaRapida([a(0, 0), a(1, 300)]);
    expect(r.ahora.map((x) => x.position)).toEqual([0]);
    expect(r.despues).toEqual({ position: 1, esperaSegundos: 300 });
  });

  it("la espera del primer mensaje tambien se respeta", () => {
    const r = planificarRespuestaRapida([a(0, 5), a(1, 0)]);
    expect(r.ahora).toEqual([]);
    expect(r.despues).toEqual({ position: 0, esperaSegundos: 5 });
  });

  it("al encontrar una espera, lo que le sigue tambien queda para despues", () => {
    const r = planificarRespuestaRapida([a(0, 0), a(1, 10), a(2, 0), a(3, 20)]);
    expect(r.ahora.map((x) => x.position)).toEqual([0]);
    expect(r.despues?.position).toBe(1);
  });

  it("al retomar, el mensaje de la espera sale ya y sigue hasta la proxima espera", () => {
    const acciones = [a(0, 0), a(1, 10), a(2, 0), a(3, 20)];
    const r = planificarRespuestaRapida(acciones, 1);
    expect(r.ahora.map((x) => x.position)).toEqual([1, 2]);
    expect(r.despues).toEqual({ position: 3, esperaSegundos: 20 });
  });

  it("al retomar el ultimo mensaje, termina", () => {
    const r = planificarRespuestaRapida([a(0, 0), a(1, 300)], 1);
    expect(r.ahora.map((x) => x.position)).toEqual([1]);
    expect(r.despues).toBeNull();
  });

  it("si la posicion para retomar ya no existe, no hace nada", () => {
    const r = planificarRespuestaRapida([a(0, 0), a(1, 300)], 7);
    expect(r.ahora).toEqual([]);
    expect(r.despues).toBeNull();
  });
});

function fakeSupabase(acciones: { position: number; action_type: string; delay_seconds: number }[]) {
  const insertados: { tabla: string; fila: Record<string, unknown> }[] = [];
  const cliente = {
    from(tabla: string) {
      const cadena: Record<string, unknown> = {
        select: () => cadena,
        eq: () => cadena,
        order: async () => ({ data: acciones }),
        insert: async (fila: Record<string, unknown>) => {
          insertados.push({ tabla, fila });
          return { error: null };
        },
      };
      return cadena;
    },
  };
  return { cliente: cliente as unknown as Parameters<typeof ejecutarRespuestaRapida>[0], insertados };
}

describe("ejecutarRespuestaRapida — programa lo que no toca todavia", () => {
  it("guarda el mensaje con espera para su hora, sin enviarlo", async () => {
    const { cliente, insertados } = fakeSupabase([{ position: 0, action_type: "send_message", delay_seconds: 300 }]);
    const antes = Date.now();
    const r = await ejecutarRespuestaRapida(cliente, { id: "qr1", workspace_id: "w1" }, "c1");
    expect(r.programada).toBe(true);
    expect(insertados).toHaveLength(1);
    expect(insertados[0].tabla).toBe("respuesta_rapida_pendientes");
    expect(insertados[0].fila).toMatchObject({ quick_reply_id: "qr1", contact_id: "c1", next_position: 0, workspace_id: "w1" });
    const runAt = new Date(insertados[0].fila.run_at as string).getTime();
    expect(runAt - antes).toBeGreaterThanOrEqual(299_000);
    expect(runAt - antes).toBeLessThanOrEqual(302_000);
  });

  it("si la posicion para retomar ya no existe, no programa nada", async () => {
    const { cliente, insertados } = fakeSupabase([{ position: 0, action_type: "send_message", delay_seconds: 300 }]);
    const r = await ejecutarRespuestaRapida(cliente, { id: "qr1", workspace_id: "w1" }, "c1", { desde: 9 });
    expect(r.programada).toBe(false);
    expect(insertados).toHaveLength(0);
  });
});
