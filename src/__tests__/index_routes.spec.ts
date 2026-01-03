import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../index";

describe("API routes", () => {
  it("serves status and metrics", async () => {
    const bot = {
      isBotRunning: () => false,
      start: vi.fn(),
      stop: vi.fn(),
      getWalletBalance: () => 123,
      setWalletBalance: vi.fn(),
      resetPositions: vi.fn(),
      resetWalletAndPositions: vi.fn(),
      getSettings: () => ({ scanIntervalMs: 5000 }),
      updateSettings: (x: any) => x,
      getPortfolio: () => ({ positions: [], summary: {} }),
      getScannedMarkets: () => [],
    } as any;

    const client = {
      getAddress: () => "0xabc",
      getApiCallsPerMinute: () => 7,
    } as any;

    const updateManager = {
      checkForUpdates: async () => ({ hasUpdate: false }),
      getLatestInfo: () => ({ hasUpdate: false, latestVersion: "0.0.0", downloadUrl: "" }),
    } as any;

    const app = createApp({
      bot,
      client,
      updateManager,
      packageVersion: "1.2.3",
      paperTrading: true,
      captureLogs: false,
    });

    const status = await request(app).get("/api/status").expect(200);
    expect(status.body.address).toBe("0xabc");
    expect(status.body.status).toBe("stopped");

    const metrics = await request(app).get("/api/metrics").expect(200);
    expect(metrics.body.apiCallsPerMinute).toBe(7);
    expect(metrics.body.scanIntervalMs).toBe(5000);
    expect(typeof metrics.body.ts).toBe("number");
  });

  it("validates wallet/set", async () => {
    const bot = {
      isBotRunning: () => false,
      start: vi.fn(),
      stop: vi.fn(),
      getWalletBalance: () => 0,
      setWalletBalance: vi.fn(),
      resetPositions: vi.fn(),
      resetWalletAndPositions: vi.fn(),
      getSettings: () => ({ scanIntervalMs: 5000 }),
      updateSettings: (x: any) => x,
      getPortfolio: () => ({ positions: [], summary: {} }),
      getScannedMarkets: () => [],
    } as any;

    const client = {
      getAddress: () => "0xabc",
      getApiCallsPerMinute: () => 0,
    } as any;

    const updateManager = {
      checkForUpdates: async () => ({ hasUpdate: false }),
      getLatestInfo: () => ({ hasUpdate: false, latestVersion: "0.0.0", downloadUrl: "" }),
    } as any;

    const app = createApp({
      bot,
      client,
      updateManager,
      packageVersion: "1.2.3",
      paperTrading: true,
      captureLogs: false,
    });

    await request(app).post("/api/wallet/set").send({ amount: -1 }).expect(400);
    await request(app).post("/api/wallet/set").send({ amount: 10 }).expect(200);
    expect(bot.setWalletBalance).toHaveBeenCalledWith(10);
  });
});
