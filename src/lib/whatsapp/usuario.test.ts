import { describe, it, expect } from "vitest";
import { esContactoSinNumero, normalizarUsuario, usuarioDeAviso } from "@/lib/whatsapp/usuario";

describe("normalizarUsuario", () => {
  it("quita el @ y los espacios", () => {
    expect(normalizarUsuario("@maria.perez")).toBe("maria.perez");
    expect(normalizarUsuario("  tienda_ana  ")).toBe("tienda_ana");
    expect(normalizarUsuario("@@raro")).toBe("raro");
  });

  it("rechaza lo que no es un usuario", () => {
    expect(normalizarUsuario(undefined)).toBeNull();
    expect(normalizarUsuario(null)).toBeNull();
    expect(normalizarUsuario(123)).toBeNull();
    expect(normalizarUsuario("")).toBeNull();
    expect(normalizarUsuario("@")).toBeNull();
    expect(normalizarUsuario("con espacios dentro")).toBeNull();
    expect(normalizarUsuario("x".repeat(65))).toBeNull();
  });
});

describe("usuarioDeAviso", () => {
  it("lo toma del perfil del contacto", () => {
    expect(usuarioDeAviso({ profile: { username: "@ana" } }, {})).toBe("ana");
  });

  it("si no esta en el perfil, lo busca en el contacto y luego en el mensaje", () => {
    expect(usuarioDeAviso({ username: "luis" }, {})).toBe("luis");
    expect(usuarioDeAviso({}, { username: "@carla" })).toBe("carla");
  });

  it("sin ningun dato devuelve null y no inventa nada", () => {
    expect(usuarioDeAviso({ profile: {} }, {})).toBeNull();
    expect(usuarioDeAviso(undefined, undefined)).toBeNull();
  });
});

describe("esContactoSinNumero", () => {
  it("distingue el identificador de un numero de telefono", () => {
    expect(esContactoSinNumero("CO.10630423800")).toBe(true);
    expect(esContactoSinNumero("573166230373")).toBe(false);
  });
});
