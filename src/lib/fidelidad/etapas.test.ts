import { describe, it, expect } from "vitest";
import {
  ETAPAS,
  ETAPAS_APAGADAS_POR_DEFECTO,
  cuerpoRenderizado,
  dentroDeLaVentana,
  diasDespuesDe,
  etapasDeHoy,
  fechaBogota,
  fechaLarga,
  frenoDeCalidad,
  parametrosDe,
  puedeSalirAhora,
  saludoDe,
  sumarDias,
  type EspacioDelCiclo,
} from "@/lib/fidelidad/etapas";
import { aplicarFrenos, type Decision } from "@/lib/fidelidad/envio";

const activo = (vencimiento: string, extra: Partial<EspacioDelCiclo> = {}): EspacioDelCiclo => ({
  estado: "active",
  accesoDesactivado: false,
  vencimiento,
  tieneLinea: true,
  ...extra,
});
const vencido = (vencimiento: string, extra: Partial<EspacioDelCiclo> = {}): EspacioDelCiclo => ({
  estado: "past_due",
  accesoDesactivado: false,
  vencimiento,
  tieneLinea: true,
  ...extra,
});
const claves = (e: EspacioDelCiclo, hoy: string) => etapasDeHoy(e, hoy).map((x) => x.clave);

describe("fechas de Bogota", () => {
  it("a las 22:00 de Bogota ya es el dia siguiente en UTC pero sigue siendo el mismo dia", () => {
    expect(fechaBogota(new Date("2026-10-07T03:00:00Z"))).toBe("2026-10-06");
  });
  it("a las 00:30 de Bogota ya es el dia nuevo", () => {
    expect(fechaBogota(new Date("2026-10-07T05:30:00Z"))).toBe("2026-10-07");
  });
  it("cuenta los dias entre fechas, cruzando fin de mes", () => {
    expect(diasDespuesDe("2026-09-28", "2026-10-05")).toBe(7);
    expect(diasDespuesDe("2026-10-05", "2026-09-28")).toBe(-7);
  });
  it("suma dias y escribe la fecha larga", () => {
    expect(sumarDias("2026-10-06", 7)).toBe("2026-10-13");
    expect(fechaLarga("2026-10-13")).toBe("13 de octubre de 2026");
  });
});

describe("ventana de envio", () => {
  it("solo entre las 9:00 y las 18:00 de Bogota", () => {
    expect(dentroDeLaVentana(new Date("2026-10-06T13:59:00Z"))).toBe(false); // 8:59
    expect(dentroDeLaVentana(new Date("2026-10-06T14:00:00Z"))).toBe(true); // 9:00
    expect(dentroDeLaVentana(new Date("2026-10-06T22:59:00Z"))).toBe(true); // 17:59
    expect(dentroDeLaVentana(new Date("2026-10-06T23:00:00Z"))).toBe(false); // 18:00
  });
});

describe("etapas de un cliente que paga", () => {
  const hoy = "2026-10-10";

  it("7 dias antes y el dia que vence, solo si el plan sigue activo", () => {
    expect(claves(activo("2026-10-17"), hoy)).toEqual(["vence_7_dias"]);
    expect(claves(vencido("2026-10-17"), hoy)).toEqual([]);
  });

  it("el dia que vence, tanto si ya cambio a past_due como si no", () => {
    expect(claves(activo("2026-10-10"), hoy)).toEqual(["vence_hoy"]);
    expect(claves(vencido("2026-10-10"), hoy)).toEqual(["vence_hoy"]);
  });

  it("despues de vencer: 1, 4, 7, 15 y 30 dias, solo si sigue sin plan", () => {
    const casos = [
      ["2026-10-09", "vencio_ayer"],
      ["2026-10-06", "sin_plan_4_dias"],
      ["2026-10-03", "sin_plan_7_dias"],
      ["2026-09-25", "sin_plan_15_dias"],
      ["2026-09-10", "ultimo_aviso_30_dias"],
    ] as const;
    for (const [fin, clave] of casos) {
      expect(claves(vencido(fin), hoy)).toEqual([clave]);
      // Si renovo, el espacio vuelve a estar activo y no se le escribe.
      expect(claves(activo(fin), hoy)).toEqual([]);
    }
  });

  it("no pone al dia a nadie: un vencido de 11 dias no recibe nada hasta que le toque su siguiente etapa", () => {
    expect(claves(vencido("2026-09-29"), hoy)).toEqual([]);
  });

  it("no escribe a quien tiene el acceso desactivado ni a quien nunca tuvo plan", () => {
    expect(claves({ estado: "past_due", accesoDesactivado: true, vencimiento: "2026-10-09" }, hoy)).toEqual([]);
    expect(claves({ estado: "trialing", accesoDesactivado: false, vencimiento: null }, hoy)).toEqual([]);
  });

  it("no le manda las etapas del demo", () => {
    expect(claves(activo("2026-10-11"), hoy)).toEqual([]);
    expect(claves(vencido("2026-10-09"), hoy)).toEqual(["vencio_ayer"]);
  });
});

describe("etapas de un demo sin pago", () => {
  const hoy = "2026-10-10";
  const demo = (vencimiento: string, estado: "active" | "past_due", diasDemo = 3) => ({
    estado,
    accesoDesactivado: false,
    vencimiento,
    esDemo: true,
    diasDemo,
    tieneLinea: true,
  });

  it("avisa un dia antes de que termine y un dia despues", () => {
    expect(claves(demo("2026-10-11", "active"), hoy)).toEqual(["demo_termina_manana"]);
    expect(claves(demo("2026-10-09", "past_due"), hoy)).toEqual(["demo_termino"]);
  });

  it("un demo de 1 dia no tiene aviso previo", () => {
    expect(claves(demo("2026-10-11", "active", 1), hoy)).toEqual([]);
  });

  it("nunca le dice 'renueva': ni 7 dias antes, ni hoy vence, ni vencio ayer", () => {
    expect(claves(demo("2026-10-17", "active"), hoy)).toEqual([]);
    expect(claves(demo("2026-10-10", "active"), hoy)).toEqual([]);
    expect(claves(demo("2026-10-09", "past_due"), hoy)).not.toContain("vencio_ayer");
  });

  it("si no compra, comparte el ultimo aviso a los 30 dias", () => {
    expect(claves(demo("2026-09-10", "past_due"), hoy)).toEqual(["ultimo_aviso_30_dias"]);
  });

  it("un demo que ya pago deja de serlo y recibe las etapas normales", () => {
    expect(claves(vencido("2026-10-09", { esDemo: false, diasDemo: 3 }), hoy)).toEqual(["vencio_ayer"]);
  });
});

describe("etapas de conexion", () => {
  it("salen 2 dias despues de empezar, solo si no hay linea y la cuenta esta activa", () => {
    const base = { estado: "active", accesoDesactivado: false, vencimiento: "2026-11-05", inicio: "2026-10-05" };
    expect(claves({ ...base, tieneLinea: false }, "2026-10-07")).toEqual(["conectar_2_dias"]);
    expect(claves({ ...base, tieneLinea: true }, "2026-10-07")).toEqual([]);
    expect(claves({ ...base, tieneLinea: false, estado: "past_due" }, "2026-10-07")).toEqual([]);
    expect(claves({ ...base, tieneLinea: false }, "2026-10-08")).toEqual([]);
  });

  it("el recordatorio del dia 7 existe pero arranca apagado", () => {
    const base = { estado: "active", accesoDesactivado: false, vencimiento: "2026-11-05", inicio: "2026-10-01", tieneLinea: false };
    expect(claves(base, "2026-10-08")).toEqual(["conectar_7_dias"]);
    expect(ETAPAS_APAGADAS_POR_DEFECTO).toContain("conectar_7_dias");
  });

  it("no pone al dia a los antiguos: una cuenta de hace 60 dias sin linea no recibe nada", () => {
    expect(claves({ estado: "active", accesoDesactivado: false, vencimiento: "2026-12-01", inicio: "2026-08-08", tieneLinea: false }, "2026-10-07")).toEqual([]);
  });

  it("si coincide con el vencimiento, ambos son candidatos y gana el de menor prio", () => {
    const e = { estado: "active", accesoDesactivado: false, vencimiento: "2026-10-14", inicio: "2026-10-05", tieneLinea: false };
    const hoy = "2026-10-07"; // inicio + 2 y vencimiento - 7
    const candidatas = etapasDeHoy(e, hoy);
    expect(candidatas.map((x) => x.clave).sort()).toEqual(["conectar_2_dias", "vence_7_dias"]);
    expect(candidatas.sort((a, b) => a.prio - b.prio)[0].clave).toBe("vence_7_dias");
  });
});

describe("frenos", () => {
  it("con calidad media solo salen los Utility; con baja, nada", () => {
    expect(frenoDeCalidad("GREEN", "MARKETING")).toBeNull();
    expect(frenoDeCalidad("YELLOW", "UTILITY")).toBeNull();
    expect(frenoDeCalidad("YELLOW", "MARKETING")).toMatch(/media/);
    expect(frenoDeCalidad("RED", "UTILITY")).toMatch(/baja/);
    // Si no se pudo consultar, se trata como media.
    expect(frenoDeCalidad(null, "MARKETING")).toMatch(/media/);
    expect(frenoDeCalidad(null, "UTILITY")).toBeNull();
  });

  const decision = (clave: string, n: number): Decision => ({
    workspaceId: `w${n}`,
    negocio: `Cliente ${n}`,
    telefono: "57300",
    etapa: ETAPAS.find((e) => e.clave === clave)!,
    periodo: "2026-10-10",
    parametros: [],
    accion: "enviar",
  });

  it("el tope diario deja sin enviar lo menos urgente", () => {
    const lista = [decision("conectar_2_dias", 1), decision("vence_hoy", 2), decision("bienvenida", 3), decision("vencio_ayer", 4)];
    const r = aplicarFrenos(lista, { calidad: "GREEN", enviadosHoy: 0, tope: 2 });
    expect(r.map((d) => d.accion === "enviar")).toEqual([false, true, false, true]);
    expect(r[0].accion).toBe("Tope diario alcanzado");
  });

  it("descuenta lo que ya salio hoy", () => {
    const r = aplicarFrenos([decision("vence_hoy", 1)], { calidad: "GREEN", enviadosHoy: 15, tope: 15 });
    expect(r[0].accion).toBe("Tope diario alcanzado");
  });

  it("un Marketing frenado no gasta cupo del tope", () => {
    const lista = [decision("ultimo_aviso_30_dias", 1), decision("vence_hoy", 2)];
    const r = aplicarFrenos(lista, { calidad: "YELLOW", enviadosHoy: 0, tope: 1 });
    expect(r[0].accion).toMatch(/media/);
    expect(r[1].accion).toBe("enviar");
  });

  it("no toca lo que ya estaba omitido", () => {
    const d = { ...decision("vence_hoy", 1), accion: "Etapa apagada" };
    expect(aplicarFrenos([d], { calidad: "RED", enviadosHoy: 0, tope: 15 })[0].accion).toBe("Etapa apagada");
  });
});

describe("mensajes", () => {
  it("saluda con nombre de la persona y del negocio, o solo con el negocio", () => {
    expect(saludoDe("Fredy Osorio", "Maxiformas")).toBe("Fredy (Maxiformas)");
    expect(saludoDe(null, "Donnato")).toBe("Donnato");
    expect(saludoDe("  ", "  Mi   Tienda ")).toBe("Mi Tienda");
  });

  it("cada etapa llena exactamente las variables de su plantilla", () => {
    const datos = { saludo: "Ana (Tienda)", negocio: "Tienda", correo: "ana@x.co", vencimiento: "2026-10-17", hoy: "2026-10-10", diasDemo: 3 };
    for (const etapa of ETAPAS) {
      const variables = new Set(etapa.cuerpo.match(/\{\{\d+\}\}/g) ?? []);
      expect(parametrosDe(etapa, datos)).toHaveLength(variables.size);
      expect(etapa.ejemplos).toHaveLength(variables.size);
      expect(cuerpoRenderizado(etapa, parametrosDe(etapa, datos))).not.toMatch(/\{\{/);
    }
  });

  it("la bienvenida al demo dice cuantos dias y hasta cuando", () => {
    const etapa = ETAPAS.find((e) => e.clave === "demo_bienvenida")!;
    const texto = cuerpoRenderizado(
      etapa,
      parametrosDe(etapa, { saludo: "Ana", negocio: "T", correo: "", vencimiento: "2026-10-12", hoy: "2026-10-10", diasDemo: 2 })
    );
    expect(texto).toContain("activa por 2 días, hasta el 12 de octubre de 2026");
  });

  it("el ultimo aviso promete la baja 7 dias despues de hoy", () => {
    const etapa = ETAPAS.find((e) => e.clave === "ultimo_aviso_30_dias")!;
    const texto = cuerpoRenderizado(
      etapa,
      parametrosDe(etapa, { saludo: "Ana", negocio: "T", correo: "", vencimiento: "2026-09-10", hoy: "2026-10-10" })
    );
    expect(texto).toContain("el 17 de octubre de 2026");
  });

  it("los nombres de plantilla y de etapa son unicos, y ninguna empieza o termina con variable", () => {
    expect(new Set(ETAPAS.map((e) => e.plantilla)).size).toBe(ETAPAS.length);
    expect(new Set(ETAPAS.map((e) => e.clave)).size).toBe(ETAPAS.length);
    for (const e of ETAPAS) {
      expect(e.cuerpo).not.toMatch(/^[\s¡¿"'(]*\{\{/);
      expect(e.cuerpo).not.toMatch(/\{\{\d+\}\}[\s.,;:!?)"'»”…]*$/);
      expect(e.cuerpo.length).toBeLessThanOrEqual(1024);
    }
  });
});

describe("registro sin plan", () => {
  const registro = ETAPAS.find((e) => e.clave === "registro_sin_plan")!;

  it("sale al instante, de día o de noche", () => {
    expect(puedeSalirAhora(registro, new Date("2026-10-21T02:25:00Z"))).toBe(true); // 21:25 en Bogotá
    expect(puedeSalirAhora(registro, new Date("2026-10-20T15:00:00Z"))).toBe(true);
  });

  it("las demás etapas siguen esperando al horario", () => {
    const vence = ETAPAS.find((e) => e.clave === "vence_hoy")!;
    expect(puedeSalirAhora(vence, new Date("2026-10-21T02:25:00Z"))).toBe(false);
    expect(puedeSalirAhora(vence, new Date("2026-10-20T15:00:00Z"))).toBe(true);
  });

  it("no depende de fechas y lleva un solo parámetro y el botón de planes", () => {
    expect(registro.dia).toBeNull();
    expect(registro.cuerpo).toContain("{{1}}");
    expect(registro.cuerpo).not.toContain("{{2}}");
    expect(registro.botones).toEqual([{ type: "URL", text: "Quiero conocer los planes", url: "https://crmbybluee.blue/dashboard/billing" }]);
    expect(etapasDeHoy({ estado: "past_due", accesoDesactivado: false, vencimiento: null }, "2026-10-21")).not.toContain(registro);
  });
});
