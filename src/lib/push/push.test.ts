import { describe, it, expect } from "vitest";
import { calcularEstado, tocaMostrarAviso, etiquetaDelBoton } from "@/lib/push/estado";
import { armarAvisoDeMensaje, vistaPreviaDeMensaje } from "@/lib/push/aviso";

const base = { soportado: true, esIos: false, instalada: false, permiso: "default" as const, suscrito: false };

describe("estado de las notificaciones", () => {
  it("sin permiso todavía: por activar", () => {
    expect(calcularEstado(base)).toBe("por-activar");
  });

  it("permiso dado y dispositivo registrado: activas", () => {
    expect(calcularEstado({ ...base, permiso: "granted", suscrito: true })).toBe("activas");
  });

  it("permiso dado pero sin registrar el dispositivo: se vuelve a registrar (por activar)", () => {
    expect(calcularEstado({ ...base, permiso: "granted", suscrito: false })).toBe("por-activar");
  });

  it("bloqueadas: hay que cambiarlo en los ajustes", () => {
    expect(calcularEstado({ ...base, permiso: "denied" })).toBe("bloqueadas");
  });

  it("iPhone sin instalar la app: instalar primero, aunque el navegador no soporte push", () => {
    expect(calcularEstado({ ...base, soportado: false, esIos: true, instalada: false, permiso: "unsupported" })).toBe("ios-instalar");
  });

  it("iPhone con la app instalada se evalúa como cualquier otro", () => {
    expect(calcularEstado({ ...base, esIos: true, instalada: true })).toBe("por-activar");
    expect(calcularEstado({ ...base, esIos: true, instalada: true, permiso: "granted", suscrito: true })).toBe("activas");
  });

  it("navegador sin soporte", () => {
    expect(calcularEstado({ ...base, soportado: false, permiso: "unsupported" })).toBe("no-soportado");
  });
});

describe("cuándo volver a mostrar el aviso", () => {
  const DIA = 86_400_000;
  it("nunca cerrado: se muestra", () => expect(tocaMostrarAviso(null, 1000)).toBe(true));
  it("cerrado hace menos de 3 días: no", () => expect(tocaMostrarAviso(0, 2 * DIA)).toBe(false));
  it("cerrado hace 3 días o más: vuelve a salir", () => expect(tocaMostrarAviso(0, 3 * DIA)).toBe(true));
  it("un valor corrupto se trata como nunca cerrado", () => expect(tocaMostrarAviso(Number.NaN, 5)).toBe(true));
});

describe("texto del botón", () => {
  it("cada estado tiene el suyo", () => {
    expect(etiquetaDelBoton("por-activar")).toBe("Activar avisos");
    expect(etiquetaDelBoton("activas")).toBe("Avisos activos");
    expect(etiquetaDelBoton("bloqueadas")).toBe("Avisos bloqueados");
    expect(etiquetaDelBoton("ios-instalar")).toBe("Instalar app");
  });
});

describe("aviso de mensaje nuevo", () => {
  it("lleva nombre y número en el título y una etiqueta por chat", () => {
    const a = armarAvisoDeMensaje({ contactName: "María", contactPhone: "573001234567", messagePreview: "Hola", conversationId: "c1" });
    expect(a.title).toBe("María — 573001234567");
    expect(a.body).toBe("Hola");
    expect(a.url).toBe("/dashboard/inbox/c1");
    expect(a.tag).toBe("chat-c1");
  });

  it("sin nombre usa solo el número, y recorta mensajes largos", () => {
    const a = armarAvisoDeMensaje({ contactName: "  ", contactPhone: "573001234567", messagePreview: "x".repeat(300), conversationId: "c2" });
    expect(a.title).toBe("573001234567");
    expect(a.body).toHaveLength(120);
  });

  it("mensaje sin texto (foto, audio) no deja la notificación vacía", () => {
    expect(armarAvisoDeMensaje({ contactName: null, contactPhone: "57300", messagePreview: "   ", conversationId: "c3" }).body).toBe("Nuevo mensaje de WhatsApp");
  });
});

describe("vista previa de lo que no trae texto", () => {
  it("usa el texto cuando hay", () => {
    expect(vistaPreviaDeMensaje("image", "  Mira esto ")).toBe("Mira esto");
  });
  it("dice que es cuando no hay texto, en vez del mensaje generico", () => {
    expect(vistaPreviaDeMensaje("image", null)).toBe("📷 Foto");
    expect(vistaPreviaDeMensaje("audio", "")).toBe("🎤 Nota de voz");
    expect(vistaPreviaDeMensaje("video", undefined)).toBe("🎥 Video");
    expect(vistaPreviaDeMensaje("sticker", null)).toBe("🩹 Sticker");
    expect(vistaPreviaDeMensaje("document", null)).toBe("📄 Documento");
  });
  it("un tipo desconocido sin texto queda con el generico", () => {
    expect(vistaPreviaDeMensaje("algo-nuevo", null)).toBe("Nuevo mensaje de WhatsApp");
  });
});

describe("cuentas reales dentro del aviso", () => {
  const base = { contactName: "Ana", contactPhone: "57300", messagePreview: "Hola", conversationId: "c9" };
  it("las lleva cuando se conocen", () => {
    const a = armarAvisoDeMensaje({ ...base, unreadTotal: 3, unreadChat: 2 });
    expect(a.unreadTotal).toBe(3);
    expect(a.unreadChat).toBe(2);
  });
  it("un cero es un dato valido (el icono se limpia)", () => {
    expect(armarAvisoDeMensaje({ ...base, unreadTotal: 0 }).unreadTotal).toBe(0);
  });
  it("si no se conocen, no se inventan", () => {
    const a = armarAvisoDeMensaje(base);
    expect("unreadTotal" in a).toBe(false);
    expect("unreadChat" in a).toBe(false);
  });
});
