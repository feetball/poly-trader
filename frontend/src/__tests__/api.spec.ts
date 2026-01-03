import { describe, expect, it, vi } from "vitest";

describe("API_BASE", () => {
  it("defaults to same-origin (empty string)", async () => {
    const old = process.env.NEXT_PUBLIC_API_URL;
    delete process.env.NEXT_PUBLIC_API_URL;

    vi.resetModules();
    const mod = await import("@/lib/api");
    expect(mod.API_BASE).toBe("");

    process.env.NEXT_PUBLIC_API_URL = old;
  });

  it("uses NEXT_PUBLIC_API_URL when set", async () => {
    const old = process.env.NEXT_PUBLIC_API_URL;
    process.env.NEXT_PUBLIC_API_URL = "http://example.test";

    vi.resetModules();
    const mod = await import("@/lib/api");
    expect(mod.API_BASE).toBe("http://example.test");

    process.env.NEXT_PUBLIC_API_URL = old;
  });
});
