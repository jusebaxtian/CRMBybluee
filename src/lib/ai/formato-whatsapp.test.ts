import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

describe("formatoWhatsApp: enlaces con formato Markdown", () => {
  it("[texto](enlace) queda como 'texto: enlace' porque WhatsApp no lo muestra como enlace", async () => {
    const { formatoWhatsApp } = await import("@/lib/ai/agent");
    expect(formatoWhatsApp("👉 [Video Testimonio](https://crmbybluee.blue)")).toBe("👉 Video Testimonio: https://crmbybluee.blue");
  });
  it("un enlace normal no cambia", async () => {
    const { formatoWhatsApp } = await import("@/lib/ai/agent");
    expect(formatoWhatsApp("Mira https://crmbybluee.blue")).toBe("Mira https://crmbybluee.blue");
  });
});
