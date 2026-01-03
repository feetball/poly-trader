import { describe, it, expect } from "vitest";
import { Bot } from "../bot";
import { PolymarketClient } from "../clients/polymarket";

describe("Fast scan support behind ALLOW_FAST_SCAN", () => {
  it("allows scanIntervalMs down to 200 when ALLOW_FAST_SCAN=true", () => {
    // Enable fast-scan for this test
    process.env.ALLOW_FAST_SCAN = "true";

    // Minimal fake client is sufficient for constructor
    const fakeClient = {} as unknown as PolymarketClient;
    const bot = new Bot(fakeClient);

    const updated = bot.updateSettings({ scanIntervalMs: 200 } as any);
    expect(updated.scanIntervalMs).toBe(200);

    // cleanup
    delete process.env.ALLOW_FAST_SCAN;
  });
});
