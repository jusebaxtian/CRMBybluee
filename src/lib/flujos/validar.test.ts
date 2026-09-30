import { describe, it, expect } from "vitest";
import { revisarFlujo, type ConexionParaValidar, type NodoParaValidar } from "@/lib/flujos/validar";
import { salidasDe } from "@/lib/flujos/bloques";

/** Inicio sin disparador: sirve para probar justamente ese aviso. */
const inicio: NodoParaValidar = { id: "i", tipo: "inicio", datos: {} };
/** Inicio completo, como queda un flujo de verdad. */
const inicioListo: NodoParaValidar = {
  id: "i",
  tipo: "inicio",
  datos: { disparadores: [{ tipo: "keyword", valor: "precio" }] },
};

describe("salidas de un bloque", () => {
  it("un bloque de botones tiene una salida por botón más la de 'otra cosa'", () => {
    const salidas = salidasDe("botones", { botones: ["Sí", "No"] });
    expect(salidas.map((s) => s.id)).toEqual(["0", "1", "otro"]);
    expect(salidas[0].etiqueta).toBe("Sí");
  });

  it("la espera tiene dos caminos", () => {
    expect(salidasDe("esperar", {}).map((s) => s.id)).toEqual(["respondio", "no_respondio"]);
  });

  it("los bloques finales no tienen salida", () => {
    expect(salidasDe("fin", {})).toHaveLength(0);
    expect(salidasDe("ia", {})).toHaveLength(0);
  });
});

describe("revisión del flujo", () => {
  it("un flujo bien armado no da errores", () => {
    const nodos: NodoParaValidar[] = [
      inicioListo,
      { id: "m", tipo: "mensaje", datos: { texto: "Hola" } },
      { id: "f", tipo: "fin", datos: {} },
    ];
    const conexiones: ConexionParaValidar[] = [
      { origen_id: "i", destino_id: "m", salida: "sig" },
      { origen_id: "m", destino_id: "f", salida: "sig" },
    ];
    expect(revisarFlujo(nodos, conexiones)).toHaveLength(0);
  });

  it("avisa del bloque que quedó suelto", () => {
    const nodos: NodoParaValidar[] = [inicio, { id: "m", tipo: "mensaje", datos: { texto: "Hola" } }];
    const avisos = revisarFlujo(nodos, []);
    expect(avisos.some((a) => a.texto.includes("no está conectado"))).toBe(true);
  });

  it("no deja pasar más botones de los que permite WhatsApp", () => {
    const nodos: NodoParaValidar[] = [
      inicio,
      { id: "b", tipo: "botones", datos: { texto: "¿Cuál?", botones: ["1", "2", "3", "4"] } },
    ];
    const avisos = revisarFlujo(nodos, [{ origen_id: "i", destino_id: "b", salida: "sig" }]);
    expect(avisos.some((a) => a.nivel === "error" && a.texto.includes("3 botones"))).toBe(true);
  });

  it("no deja pasar un botón con título largo", () => {
    const nodos: NodoParaValidar[] = [
      inicio,
      { id: "b", tipo: "botones", datos: { texto: "¿Cuál?", botones: ["Quiero que me llamen ya mismo"] } },
    ];
    const avisos = revisarFlujo(nodos, [{ origen_id: "i", destino_id: "b", salida: "sig" }]);
    expect(avisos.some((a) => a.nivel === "error" && a.texto.includes("20 caracteres"))).toBe(true);
  });

  it("avisa cuando el flujo no termina en ningún lado", () => {
    const nodos: NodoParaValidar[] = [inicio, { id: "m", tipo: "mensaje", datos: { texto: "Hola" } }];
    const conexiones: ConexionParaValidar[] = [{ origen_id: "i", destino_id: "m", salida: "sig" }];
    expect(revisarFlujo(nodos, conexiones).some((a) => a.texto.includes("no termina"))).toBe(true);
  });

  it("marca la espera sin minutos", () => {
    const nodos: NodoParaValidar[] = [inicio, { id: "e", tipo: "esperar", datos: { minutos: 0 } }];
    const avisos = revisarFlujo(nodos, [{ origen_id: "i", destino_id: "e", salida: "sig" }]);
    expect(avisos.some((a) => a.nivel === "error" && a.texto.includes("1 minuto"))).toBe(true);
  });
});

describe("disparadores del inicio", () => {
  const conDisparador: NodoParaValidar = {
    id: "i",
    tipo: "inicio",
    datos: { disparadores: [{ tipo: "keyword", valor: "precio" }] },
  };

  it("avisa cuando el inicio no tiene disparador", () => {
    const avisos = revisarFlujo([inicio, { id: "f", tipo: "fin", datos: {} }], [
      { origen_id: "i", destino_id: "f", salida: "sig" },
    ]);
    expect(avisos.some((a) => a.texto.includes("nadie va a entrar"))).toBe(true);
  });

  it("no avisa cuando sí lo tiene", () => {
    const avisos = revisarFlujo([conDisparador, { id: "f", tipo: "fin", datos: {} }], [
      { origen_id: "i", destino_id: "f", salida: "sig" },
    ]);
    expect(avisos).toHaveLength(0);
  });

  it("marca la palabra clave vacía", () => {
    const nodos: NodoParaValidar[] = [
      { id: "i", tipo: "inicio", datos: { disparadores: [{ tipo: "keyword", valor: "  " }] } },
      { id: "f", tipo: "fin", datos: {} },
    ];
    const avisos = revisarFlujo(nodos, [{ origen_id: "i", destino_id: "f", salida: "sig" }]);
    expect(avisos.some((a) => a.nivel === "error" && a.texto.includes("sin palabra"))).toBe(true);
  });

  it("marca la etiqueta sin elegir", () => {
    const nodos: NodoParaValidar[] = [
      { id: "i", tipo: "inicio", datos: { disparadores: [{ tipo: "tag" }] } },
      { id: "f", tipo: "fin", datos: {} },
    ];
    const avisos = revisarFlujo(nodos, [{ origen_id: "i", destino_id: "f", salida: "sig" }]);
    expect(avisos.some((a) => a.nivel === "error" && a.texto.includes("sin etiqueta"))).toBe(true);
  });
});

describe("la regla de las 24 horas", () => {
  const inicioListo2: NodoParaValidar = {
    id: "i",
    tipo: "inicio",
    datos: { disparadores: [{ tipo: "keyword", valor: "precio" }] },
  };

  it("no deja mandar un mensaje normal después de esperar un día", () => {
    const nodos: NodoParaValidar[] = [
      inicioListo2,
      { id: "e", tipo: "esperar", datos: { minutos: 1440 } },
      { id: "m", tipo: "mensaje", datos: { texto: "¿Sigues interesado?" } },
    ];
    const conexiones: ConexionParaValidar[] = [
      { origen_id: "i", destino_id: "e", salida: "sig" },
      { origen_id: "e", destino_id: "m", salida: "no_respondio" },
    ];
    const avisos = revisarFlujo(nodos, conexiones);
    expect(avisos.some((a) => a.nivel === "error" && a.texto.includes("plantilla aprobada"))).toBe(true);
  });

  it("con plantilla sí lo deja", () => {
    const nodos: NodoParaValidar[] = [
      inicioListo2,
      { id: "e", tipo: "esperar", datos: { minutos: 1440 } },
      { id: "p", tipo: "plantilla", datos: { plantillaId: "t1", plantillaNombre: "recordatorio" } },
    ];
    const conexiones: ConexionParaValidar[] = [
      { origen_id: "i", destino_id: "e", salida: "sig" },
      { origen_id: "e", destino_id: "p", salida: "no_respondio" },
    ];
    expect(revisarFlujo(nodos, conexiones).some((a) => a.nivel === "error")).toBe(false);
  });

  it("una espera corta no exige plantilla", () => {
    const nodos: NodoParaValidar[] = [
      inicioListo2,
      { id: "e", tipo: "esperar", datos: { minutos: 5 } },
      { id: "m", tipo: "mensaje", datos: { texto: "¿Sigues ahí?" } },
    ];
    const conexiones: ConexionParaValidar[] = [
      { origen_id: "i", destino_id: "e", salida: "sig" },
      { origen_id: "e", destino_id: "m", salida: "no_respondio" },
    ];
    expect(revisarFlujo(nodos, conexiones).some((a) => a.nivel === "error")).toBe(false);
  });
});

describe("bloques nuevos sin configurar", () => {
  const i: NodoParaValidar = { id: "i", tipo: "inicio", datos: { disparadores: [{ tipo: "any_message" }] } };
  const conectar = (destino: string): ConexionParaValidar[] => [
    { origen_id: "i", destino_id: destino, salida: "sig" },
  ];

  it.each([
    ["plantilla", "plantilla que se va a enviar"],
    ["condicion", "etiqueta elegida"],
    ["etiqueta", "qué etiqueta poner"],
    ["respuesta_rapida", "respuesta rápida"],
    ["automatizacion", "automatización que se va a disparar"],
    ["saltar", "a qué flujo salta"],
  ])("marca el bloque %s vacío", (tipo, textoEsperado) => {
    const nodos: NodoParaValidar[] = [i, { id: "x", tipo: tipo as NodoParaValidar["tipo"], datos: {} }];
    const avisos = revisarFlujo(nodos, conectar("x"));
    expect(avisos.some((a) => a.nivel === "error" && a.texto.includes(textoEsperado))).toBe(true);
  });
});
