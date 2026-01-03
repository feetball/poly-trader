import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Bot } from "../bot";

describe("Bot runOnce", () => {
  it("scans markets, subscribes, and opens an updown position", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "poly-trader-bot-"));
    process.env.SETTINGS_PATH = path.join(dir, "settings.json");

    const client = {
      getGammaMarkets: vi.fn(async () => [
        {
          slug: "sports-xyz",
          markets: [
            {
              id: "m1",
              question: "Q",
              volume: 100,
              outcomePrices: '["0.50","0.50"]',
              clobTokenIds: '["a","b"]',
            },
          ],
        },
      ]),
    };

    const bot = new Bot(client as any);

    // replace market stream to avoid real WS
    (bot as any).marketStream = { subscribe: vi.fn() };

    bot.updateSettings({
      enabledStrategies: ["updown_15"],
      maxPositionSize: 100,
      stopLossPercentage: 50,
      takeProfitPercentage: 50,
      scanIntervalMs: 1000,
      updownHoldMs: 15 * 60 * 1000,
    } as any);

    // force strategies to just return one opportunity
    (bot as any).strategies = [
      {
        id: "updown_15",
        name: "UpDown",
        description: "",
        analyze: vi.fn(async () => [
          {
            marketId: "m1",
            question: "Q",
            outcome: "YES",
            price: 0.5,
            size: 10,
            confidence: 1,
          },
        ]),
      },
    ];

    // call the private single-iteration method
    await (bot as any).runOnce();

    expect((bot as any).marketStream.subscribe).toHaveBeenCalled();
    expect((bot as any).positionManager.hasOpenPosition("m1", "YES")).toBe(true);

    delete process.env.SETTINGS_PATH;
  });
});
