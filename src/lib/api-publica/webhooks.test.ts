import { describe, it, expect } from "vitest";
import { esIpPrivada, firmar, cabeceraDeFirma, siguienteIntento, motivoDeUrlInsegura, generarSecreto, RETRASOS_S, MAX_INTENTOS } from "@/lib/api-publica/webhooks";
import { eventosValidos, EVENTOS } from "@/lib/api-publica/eventos";

describe("protección contra SSRF", () => {
  it("reconoce direcciones internas", () => {
    for (const ip of ["127.0.0.1", "10.0.0.5", "172.16.0.1", "172.31.255.255", "192.168.1.10", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1", "224.0.0.1"]) {
      expect(esIpPrivada(ip), ip).toBe(true);
    }
  });

  it("deja pasar direcciones públicas", () => {
    for (const ip of ["8.8.8.8", "172.32.0.1", "1.1.1.1", "2606:4700:4700::1111"]) {
      expect(esIpPrivada(ip), ip).toBe(false);
    }
  });

  it("rechaza URLs que no son https, con credenciales o internas", async () => {
    expect(await motivoDeUrlInsegura("http://ejemplo.com/hook")).toMatch(/https/);
    expect(await motivoDeUrlInsegura("no es una url")).toMatch(/válida/);
    expect(await motivoDeUrlInsegura("https://user:pass@ejemplo.com/")).toMatch(/usuario/);
    expect(await motivoDeUrlInsegura("https://localhost/hook")).toMatch(/interna/);
    expect(await motivoDeUrlInsegura("https://127.0.0.1/hook")).toMatch(/interna/);
    expect(await motivoDeUrlInsegura("https://169.254.169.254/latest/meta-data")).toMatch(/interna/);
    expect(await motivoDeUrlInsegura("https://[::1]/hook")).toMatch(/interna/);
    expect(await motivoDeUrlInsegura("https://servicio.internal/hook")).toMatch(/interna/);
  });

  it("acepta una IP pública escrita directamente", async () => {
    expect(await motivoDeUrlInsegura("https://8.8.8.8/hook")).toBeNull();
  });
});

describe("firma", () => {
  it("es estable y depende del secreto, el tiempo y el cuerpo", () => {
    const base = firmar("whsec_a", 1000, '{"x":1}');
    expect(base).toBe(firmar("whsec_a", 1000, '{"x":1}'));
    expect(base).not.toBe(firmar("whsec_b", 1000, '{"x":1}'));
    expect(base).not.toBe(firmar("whsec_a", 1001, '{"x":1}'));
    expect(base).not.toBe(firmar("whsec_a", 1000, '{"x":2}'));
    expect(cabeceraDeFirma("whsec_a", 1000, '{"x":1}')).toBe(`t=1000,v1=${base}`);
  });

  it("el secreto generado tiene prefijo y no se repite", () => {
    const a = generarSecreto();
    expect(a.startsWith("whsec_")).toBe(true);
    expect(a).not.toBe(generarSecreto());
  });
});

describe("reintentos", () => {
  it("espera más cada vez y se rinde al final", () => {
    const t = 1_000_000;
    expect(siguienteIntento(1, t)?.getTime()).toBe(t + RETRASOS_S[0] * 1000);
    expect(siguienteIntento(5, t)?.getTime()).toBe(t + RETRASOS_S[4] * 1000);
    expect(siguienteIntento(MAX_INTENTOS, t)).toBeNull();
    expect(RETRASOS_S).toEqual([...RETRASOS_S].sort((a, b) => a - b));
  });
});

describe("eventos", () => {
  it("solo acepta los conocidos", () => {
    expect(eventosValidos(["mensaje.recibido", "mensaje.recibido", "inventado", 3])).toEqual(["mensaje.recibido"]);
    expect(eventosValidos("mensaje.recibido")).toEqual([]);
    expect(EVENTOS.length).toBe(9);
  });
});
