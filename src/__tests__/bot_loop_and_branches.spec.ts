import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Bot } from "../bot";

describe("Bot loop/branch coverage", () => {
  it("runLoop catches errors and sleeps before exiting", async () => {
    vi.useFakeTimers();

    const client = { getGammaMarkets: vi.fn(async () => []) };
    const bot = new Bot(client as any);

    // Ensure a short sleep so fake timers can resolve the loop.
    bot.updateSettings({ scanIntervalMs: 1000, enabledStrategies: [] } as any);

    const err = vi.spyOn(console, "error").mockImplementation(() => {});

    (bot as any).isRunning = true;
    (bot as any).runOnce = vi.fn(async () => {
      throw new Error("boom");
    });

    const p = (bot as any).runLoop();

    // stop after first iteration
    (bot as any).isRunning = false;

    await vi.advanceTimersByTimeAsync(1000);
    await p;

    expect(err).toHaveBeenCalled();
    err.mockRestore();
    vi.useRealTimers();
  });

  it("runOnce handles non-array events and disabled strategies", async () => {
    const client = { getGammaMarkets: vi.fn(async () => ({ not: "array" })) };
    const bot = new Bot(client as any);

    const pm = {
      updateRiskLimits: vi.fn(),
      updatePrices: vi.fn(),
      closeExpiredPositions: vi.fn(),
      hasOpenPosition: vi.fn(() => false),
      addPosition: vi.fn(() => true),
      setPositionMeta: vi.fn(),
    };

    (bot as any).positionManager = pm;
    (bot as any).marketStream = { subscribe: vi.fn(), on: vi.fn(), connect: vi.fn() };

    bot.updateSettings({ enabledStrategies: [] } as any);
    (bot as any).strategies = [
      { id: "updown_15", name: "UpDown", description: "", analyze: vi.fn(async () => [{ marketId: "m1" }]) },
    ];

    await (bot as any).runOnce();

    expect(pm.updateRiskLimits).toHaveBeenCalled();
    expect(pm.updatePrices).not.toHaveBeenCalled();
    expect((bot as any).marketStream.subscribe).not.toHaveBeenCalled();
    expect((bot as any).strategies[0].analyze).not.toHaveBeenCalled();
  });

  it("runOnce tolerates malformed market JSON and skips invalid updown opportunities", async () => {
    const client = {
      getGammaMarkets: vi.fn(async () => [
        {
          slug: "sports-xyz",
          markets: [
            {
              id: "m1",
              question: "Q",
              volume: 100,
              outcomePrices: "not json",
              clobTokenIds: "not json",
            },
          ],
        },
      ]),
    };

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "poly-trader-bot-"));
    process.env.SETTINGS_PATH = path.join(dir, "settings.json");

    const bot = new Bot(client as any);

    const pm = {
      updateRiskLimits: vi.fn(),
      updatePrices: vi.fn(),
      closeExpiredPositions: vi.fn(),
      hasOpenPosition: vi.fn(() => true),
      addPosition: vi.fn(() => false),
      setPositionMeta: vi.fn(),
    };

    (bot as any).positionManager = pm;
    (bot as any).marketStream = { subscribe: vi.fn(), on: vi.fn(), connect: vi.fn() };

    bot.updateSettings({ enabledStrategies: ["updown_15"], maxPositionSize: 50 } as any);

    (bot as any).strategies = [
      {
        id: "updown_15",
        name: "UpDown",
        description: "",
        analyze: vi.fn(async () => [
          { marketId: "m1", outcome: "BOTH", price: 0.5 },
          { marketId: "m1", outcome: "YES", price: 0 },
          { marketId: "m1", outcome: "YES", price: 1 },
          { marketId: "m1", outcome: "YES", price: 0.5, size: 10 },
        ]),
      },
    ];

    await (bot as any).runOnce();

    // outcomePrices/clobTokenIds were malformed -> no subscribe
    expect((bot as any).marketStream.subscribe).not.toHaveBeenCalled();

    // outcomePrices parse failure defaults prob to 0.5, so updatePrices is called
    expect(pm.updatePrices).toHaveBeenCalledTimes(1);

    // hasOpenPosition returned true, and other opps were invalid -> addPosition never called
    expect(pm.addPosition).not.toHaveBeenCalled();

    delete process.env.SETTINGS_PATH;
  });
});
