import { describe, expect, it, vi, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "../index";

afterEach(() => {
  // If any test enabled log capture, restore console.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyGlobal: any = globalThis as any;
  if (anyGlobal.__restoreConsole) {
    anyGlobal.__restoreConsole();
    delete anyGlobal.__restoreConsole;
  }
});

describe("createApp routes", () => {
  it("serves root and version", async () => {
    const bot = {
      isBotRunning: vi.fn(() => false),
      start: vi.fn(),
      stop: vi.fn(),
      getWalletBalance: vi.fn(() => 123),
      setWalletBalance: vi.fn(),
      resetPositions: vi.fn(),
      resetWalletAndPositions: vi.fn(),
      getSettings: vi.fn(() => ({ scanIntervalMs: 5000 })),
      updateSettings: vi.fn((b: any) => b),
      getPortfolio: vi.fn(() => ({ positions: [] })),
      getScannedMarkets: vi.fn(() => []),
    };

    const client = {
      getAddress: vi.fn(() => "0xabc"),
      getApiCallsPerMinute: vi.fn(() => 7),
    };

    const updateManager = {
      checkForUpdates: vi.fn(async () => ({ hasUpdate: false })),
      getLatestInfo: vi.fn(() => ({ hasUpdate: false, latestVersion: "0.0.0" })),
    };

    const app = createApp({
      bot: bot as any,
      client: client as any,
      updateManager: updateManager as any,
      packageVersion: "1.2.3",
      paperTrading: true,
      captureLogs: false,
    });

    const root = await request(app).get("/");
    expect(root.status).toBe(200);
    expect(root.text).toContain("PolyTrader Bot API");

    const version = await request(app).get("/api/version");
    expect(version.status).toBe(200);
    expect(version.body.currentVersion).toBe("1.2.3");
  });

  it("starts/stops bot and validates wallet set", async () => {
    let running = false;
    const bot = {
      isBotRunning: vi.fn(() => running),
      start: vi.fn(() => {
        running = true;
      }),
      stop: vi.fn(() => {
        running = false;
      }),
      getWalletBalance: vi.fn(() => 100),
      setWalletBalance: vi.fn(),
      resetPositions: vi.fn(),
      resetWalletAndPositions: vi.fn(),
      getSettings: vi.fn(() => ({ scanIntervalMs: 5000 })),
      updateSettings: vi.fn((b: any) => b),
      getPortfolio: vi.fn(() => ({ positions: [] })),
      getScannedMarkets: vi.fn(() => []),
    };

    const client = {
      getAddress: vi.fn(() => "0xabc"),
      getApiCallsPerMinute: vi.fn(() => 0),
    };

    const updateManager = {
      checkForUpdates: vi.fn(async () => ({ hasUpdate: false })),
      getLatestInfo: vi.fn(() => ({ hasUpdate: false })),
    };

    const app = createApp({
      bot: bot as any,
      client: client as any,
      updateManager: updateManager as any,
      packageVersion: "1.0.0",
      paperTrading: true,
      captureLogs: false,
    });

    const s1 = await request(app).post("/api/bot/start");
    expect(s1.status).toBe(200);
    expect(s1.body.running).toBe(true);

    const s2 = await request(app).post("/api/bot/stop");
    expect(s2.status).toBe(200);
    expect(s2.body.running).toBe(false);

    const bad = await request(app).post("/api/wallet/set").send({ amount: -1 });
    expect(bad.status).toBe(400);

    (bot.getWalletBalance as any).mockReturnValueOnce(200);
    const ok = await request(app).post("/api/wallet/set").send({ amount: 200 });
    expect(ok.status).toBe(200);
    expect(bot.setWalletBalance).toHaveBeenCalledWith(200);
  });

  it("handles settings, metrics, logs, and update-check error path", async () => {
    const bot = {
      isBotRunning: vi.fn(() => false),
      start: vi.fn(),
      stop: vi.fn(),
      getWalletBalance: vi.fn(() => 123),
      setWalletBalance: vi.fn(),
      resetPositions: vi.fn(),
      resetWalletAndPositions: vi.fn(),
      getSettings: vi.fn(() => ({ scanIntervalMs: 2500 })),
      updateSettings: vi.fn((b: any) => ({ ...b, ok: true })),
      getPortfolio: vi.fn(() => ({ positions: [] })),
      getScannedMarkets: vi.fn(() => []),
    };

    const client = {
      getAddress: vi.fn(() => "0xabc"),
      getApiCallsPerMinute: vi.fn(() => 42),
    };

    const updateManager = {
      checkForUpdates: vi.fn(async () => {
        throw new Error("boom");
      }),
      getLatestInfo: vi.fn(() => ({ hasUpdate: false })),
    };

    const app = createApp({
      bot: bot as any,
      client: client as any,
      updateManager: updateManager as any,
      packageVersion: "1.0.0",
      paperTrading: true,
      captureLogs: true,
    });

    // stash restore function to use in afterEach
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).__restoreConsole = app.locals.restoreConsole;

    const sget = await request(app).get("/api/settings");
    expect(sget.status).toBe(200);
    expect(sget.body.scanIntervalMs).toBe(2500);

    const spost = await request(app).post("/api/settings").send({ scanIntervalMs: 1111 });
    expect(spost.status).toBe(200);
    expect(spost.body.ok).toBe(true);

    const metrics = await request(app).get("/api/metrics");
    expect(metrics.status).toBe(200);
    expect(metrics.body.apiCallsPerMinute).toBe(42);
    expect(metrics.body.scanIntervalMs).toBe(2500);

    console.log("hello from test");
    const logs = await request(app).get("/api/logs");
    expect(logs.status).toBe(200);
    expect(Array.isArray(logs.body.entries)).toBe(true);

    const clear = await request(app).post("/api/logs/clear");
    expect(clear.status).toBe(200);

    const update = await request(app).post("/api/check-update");
    expect(update.status).toBe(500);
  });
});
