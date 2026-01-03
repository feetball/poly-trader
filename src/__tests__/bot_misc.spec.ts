import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Bot } from "../bot";

describe("Bot misc methods", () => {
  it("start/stop toggles state and connects stream", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "poly-trader-bot-"));
    process.env.SETTINGS_PATH = path.join(dir, "settings.json");

    const client = { getGammaMarkets: vi.fn(async () => []) };
    const bot = new Bot(client as any);

    (bot as any).marketStream = { connect: vi.fn(), on: vi.fn(), subscribe: vi.fn() };
    (bot as any).runLoop = vi.fn(async () => {});

    expect(bot.isBotRunning()).toBe(false);
    await bot.start();
    expect(bot.isBotRunning()).toBe(true);
    expect((bot as any).marketStream.connect).toHaveBeenCalled();

    await bot.stop();
    expect(bot.isBotRunning()).toBe(false);

    delete process.env.SETTINGS_PATH;
  });

  it("wallet setters clamp to non-negative", () => {
    const client = { getGammaMarkets: vi.fn(async () => []) };
    const bot = new Bot(client as any);

    bot.setWalletBalance(-5);
    expect(bot.getWalletBalance()).toBe(0);

    bot.setWalletBalance(123.45);
    expect(bot.getWalletBalance()).toBe(123.45);
  });

  it("resetPositions and resetWalletAndPositions call positionManager", () => {
    const client = { getGammaMarkets: vi.fn(async () => []) };
    const bot = new Bot(client as any);

    (bot as any).positionManager = {
      clearAllPositions: vi.fn(),
      getDailyPnL: vi.fn(() => 0),
      getPositions: vi.fn(() => []),
    };

    bot.resetPositions();
    expect((bot as any).positionManager.clearAllPositions).toHaveBeenCalledTimes(1);

    bot.resetWalletAndPositions(-10);
    expect(bot.getWalletBalance()).toBe(0);
    expect((bot as any).positionManager.clearAllPositions).toHaveBeenCalledTimes(2);
  });

  it("getPortfolio returns mock when empty and computed summary when non-empty", () => {
    const client = { getGammaMarkets: vi.fn(async () => []) };
    const bot = new Bot(client as any);

    // Empty -> mock
    (bot as any).positionManager = {
      getPositions: vi.fn(() => []),
      getDailyPnL: vi.fn(() => 5),
    };

    const empty = bot.getPortfolio();
    expect(empty.positions.length).toBe(2);
    expect(empty.summary.dailyRealizedPnL).toBe(5);

    // Non-empty -> computed
    (bot as any).positionManager = {
      getPositions: vi.fn(() => [{ pnl: 10 }, { pnl: -3 }, { pnl: 0 }] as any),
      getDailyPnL: vi.fn(() => 2),
    };

    const filled = bot.getPortfolio();
    expect(filled.positions.length).toBe(3);
    expect(filled.summary.totalUnrealizedPnL).toBe(7);
    expect(filled.summary.openWinners).toBe(1);
    expect(filled.summary.openLosers).toBe(1);
    expect(filled.summary.dailyRealizedPnL).toBe(2);
  });

  it("analyzeUser delegates to UserAnalysisService", async () => {
    const client = { getGammaMarkets: vi.fn(async () => []) };
    const bot = new Bot(client as any);

    (bot as any).userAnalysis = {
      getUserTrades: vi.fn(async () => [{ id: "x" }]),
    };

    const trades = await bot.analyzeUser("0xabc");
    expect(trades.length).toBe(1);
    expect((bot as any).userAnalysis.getUserTrades).toHaveBeenCalledWith("0xabc");
  });

  it("updateSettings clamps scanIntervalMs and updownHoldMs", () => {
    const client = { getGammaMarkets: vi.fn(async () => []) };
    const bot = new Bot(client as any);

    const s1 = bot.updateSettings({ scanIntervalMs: 10, updownHoldMs: 1 } as any);
    expect(s1.scanIntervalMs).toBe(1000);
    expect(s1.updownHoldMs).toBe(60_000);

    const s2 = bot.updateSettings({ scanIntervalMs: 10 * 60 * 1000, updownHoldMs: 10 * 60 * 60 * 1000 } as any);
    expect(s2.scanIntervalMs).toBe(5 * 60 * 1000);
    expect(s2.updownHoldMs).toBe(60 * 60 * 1000);
  });
});
