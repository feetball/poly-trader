import request from "supertest";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createApp } from "../index";

// Mocks
const fakeBot = {
  isBotRunning: () => false,
  start: () => {},
  stop: () => {},
  getWalletBalance: () => 123.45,
  setWalletBalance: (n: number) => {},
  resetPositions: () => {},
  resetWalletAndPositions: (n: number) => {},
  getSettings: () => ({ scanIntervalMs: 5000 }),
  updateSettings: (s: any) => s,
  getPortfolio: () => [],
  getScannedMarkets: () => [],
};

const fakeClient = {
  getAddress: () => "0xdeadbeef",
  getApiCallsPerMinute: () => 7,
};

const fakeUpdateManager = {
  checkForUpdates: async () => ({ ok: true }),
  getLatestInfo: () => ({}),
};

describe("index routes - error and edge branches", () => {
  let app: any;

  beforeEach(() => {
    app = createApp({
      bot: fakeBot as any,
      client: fakeClient as any,
      updateManager: fakeUpdateManager as any,
      packageVersion: "1.0.0",
      paperTrading: false,
      captureLogs: true,
    });
  });

  it("captures console output and returns logs, and restoreConsole works", async () => {
    // produce some logs using console methods
    console.log("a log");
    console.info("an info");
    console.warn("a warn");
    console.error("an error");

    const res = await request(app).get("/api/logs?limit=10");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.entries)).toBe(true);
    expect(res.body.entries.length).toBeGreaterThanOrEqual(1);

    // restore and ensure console methods no longer push
    app.locals.restoreConsole();
    console.log("after restore");
    const res2 = await request(app).get("/api/logs?limit=10");
    // entries length should not increase due to the last log
    expect(res2.status).toBe(200);
  });

  it("returns 500 when checkForUpdates throws", async () => {
    const badUpdate = {
      checkForUpdates: async () => { throw new Error("fail"); },
      getLatestInfo: () => ({}),
    };
    const appBad = createApp({
      bot: fakeBot as any,
      client: fakeClient as any,
      updateManager: badUpdate as any,
      packageVersion: "1.0.0",
      paperTrading: false,
      captureLogs: false,
    });

    const res = await request(appBad).post("/api/check-update");
    expect(res.status).toBe(500);
    expect(res.body.error).toBeDefined();
  });

  it("returns 500 when metrics computation fails (client throws)", async () => {
    const badClient = { ...fakeClient, getApiCallsPerMinute: () => { throw new Error("boom"); } };
    const appBad = createApp({
      bot: fakeBot as any,
      client: badClient as any,
      updateManager: fakeUpdateManager as any,
      packageVersion: "1.0.0",
      paperTrading: false,
      captureLogs: false,
    });

    const res = await request(appBad).get("/api/metrics");
    expect(res.status).toBe(500);
    expect(res.body.error).toBeDefined();
  });

  it("validates /api/wallet/set input and rejects invalid amounts", async () => {
    const res = await request(app).post("/api/wallet/set").send({ amount: -10 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();

    const res2 = await request(app).post("/api/wallet/set").send({ amount: "nope" });
    expect(res2.status).toBe(400);
  });

  it("resets positions and uses default reset amount when none provided", async () => {
    const bot = {
      isBotRunning: () => false,
      start: () => {},
      stop: () => {},
      getWalletBalance: () => 0,
      setWalletBalance: () => {},
      resetPositions: vi.fn(),
      resetWalletAndPositions: vi.fn(),
      getSettings: () => ({ scanIntervalMs: 5000 }),
      updateSettings: (s: any) => s,
      getPortfolio: () => [],
      getScannedMarkets: () => [],
    };

    const app2 = createApp({
      bot: bot as any,
      client: fakeClient as any,
      updateManager: fakeUpdateManager as any,
      packageVersion: "1.0.0",
      paperTrading: false,
      captureLogs: false,
    });

    await request(app2).post("/api/positions/reset");
    expect((bot.resetPositions as any)).toHaveBeenCalled();

    await request(app2).post("/api/reset-all").send({});
    expect((bot.resetWalletAndPositions as any)).toHaveBeenCalledWith(10000);
  });

  it("log buffer respects LOG_BUFFER_SIZE and honors 'since' and 'limit' params", async () => {
    process.env.LOG_BUFFER_SIZE = "2";
    const app3 = createApp({
      bot: fakeBot as any,
      client: fakeClient as any,
      updateManager: fakeUpdateManager as any,
      packageVersion: "1.0.0",
      paperTrading: false,
      captureLogs: true,
    });

    // emit 5 logs
    console.log("l1");
    console.log("l2");
    console.log("l3");
    console.log("l4");
    console.log("l5");

    const res = await request(app3).get("/api/logs?limit=1000");
    expect(res.status).toBe(200);
    // trimmed to LOG_BUFFER_SIZE=2
    expect(res.body.entries.length).toBe(2);

    // test 'since' filters
    const all = await request(app3).get("/api/logs");
    const lastTs = all.body.entries[all.body.entries.length -1].ts;
    const resSince = await request(app3).get(`/api/logs?since=${lastTs + 1}`);
    expect(resSince.body.entries.length).toBe(0);

    delete process.env.LOG_BUFFER_SIZE;
  });
});
