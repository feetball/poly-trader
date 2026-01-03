import { describe, expect, it, vi } from "vitest";

const DUMMY_PK = "0x0123456789012345678901234567890123456789012345678901234567890123";

describe("PolymarketClient constructor branches", () => {
  it("throws if neither privateKey nor paperTrading", async () => {
    vi.resetModules();
    const mod = await import("../clients/polymarket");
    const { PolymarketClient } = mod;
    expect(() => new PolymarketClient(undefined, false)).toThrow(
      "Private key is required for real trading"
    );
  });

  it("initialize rethrows if ClobClient constructor fails", async () => {
    vi.resetModules();

    vi.doMock("@polymarket/clob-client", () => {
      return {
        ClobClient: class {
          constructor() {
            throw new Error("boom");
          }
        }
      };
    });

    const { PolymarketClient } = await import("../clients/polymarket");
    const c = new PolymarketClient(DUMMY_PK, true);
    await expect(c.initialize()).rejects.toThrow("boom");

    vi.doUnmock("@polymarket/clob-client");
  });
});
