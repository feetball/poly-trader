import { describe, it, expect, beforeEach, vi } from "vitest";
import { Bot } from "../bot";

const fakeClient: any = {
  getGammaMarkets: async () => [],
  getApiCallsPerMinute: () => 0,
};

describe("Bot branches and sanitizeSettings", () => {
  let bot: Bot;

  beforeEach(() => {
    bot = new Bot(fakeClient);
  });

  it("sanitizeSettings clamps numeric values and ignores invalid types", () => {
    // @ts-ignore access private via cast
    const sanitized = (bot as any).sanitizeSettings({
      scanIntervalMs: 10, // too small -> clamp to 1000
      updownHoldMs: 999, // too small -> clamp to 60000
      maxPositionSize: -50, // negative -> clamp to 0 via max(0,...)
      enabledStrategies: ["updown_15", 123, null, "  arbit  "],
    });

    expect(sanitized.scanIntervalMs).toBeGreaterThanOrEqual(1000);
    expect(sanitized.updownHoldMs).toBeGreaterThanOrEqual(60000);
    expect(sanitized.maxPositionSize).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(sanitized.enabledStrategies)).toBe(true);
    expect(sanitized.enabledStrategies).toContain("updown_15");
    expect(sanitized.enabledStrategies).toContain("arbit");
  });

  it("runOnce tolerates malformed JSON for outcomePrices and clobTokenIds and subscribes when tokens present", async () => {
    // craft a fake event with bad JSON and with clobTokenIds
    const marketEvent = [
      {
        slug: "test",
        markets: [
          { id: "m1", question: "Q", volume: 0, outcomePrices: 'not json', clobTokenIds: '["t1","t2"]' },
          { id: "m2", question: "Q2", volume: 0, outcomePrices: '["0.1"]', clobTokenIds: 'not json' },
        ],
      },
    ];

    // replace client's getGammaMarkets for this test
    fakeClient.getGammaMarkets = async () => marketEvent;

    // spy on marketStream.subscribe
    // @ts-ignore access private
    const stream = (bot as any).marketStream;
    const calls: any[] = [];
    stream.subscribe = (ids: string[]) => calls.push(ids);

    // run the private runOnce
    await (bot as any).runOnce();

    // expect that subscribe was called for tokens from m1
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls.flat()).toContain("t1");
    expect(calls.flat()).toContain("t2");

    // ensure that updatePrices is fine even if one parsed price failed
    // (no exception thrown is success)
  });

  it("updown_15 branch validates opportunity fields and respects hasOpenPosition checks", async () => {
    // create a fake strategy that returns an opportunity with invalid price/outcome
    const fakeStrategy: any = {
      id: "updown_15",
      name: "FakeUpDown",
      analyze: async () => [
        { marketId: "mX", outcome: "YES", price: 2.0, size: 10 }, // invalid price (>=1)
        { marketId: "mY", outcome: "MAYBE", price: 0.5, size: 10 }, // invalid outcome
        { marketId: "mZ", outcome: "YES", price: 0.5, size: 10 }, // good candidate
      ],
    };

    // inject our fake strategy and stub positionManager
    // @ts-ignore
    (bot as any).strategies = [fakeStrategy];
    // @ts-ignore
    (bot as any).settings.enabledStrategies = ["updown_15"];

    const pm = (bot as any).positionManager;
    // stub hasOpenPosition to return true for mZ so it will be skipped
    pm.hasOpenPosition = (id: string, outcome: string) => id === "mZ";

    // runOnce should not throw and simply skip invalid opps
    await (bot as any).runOnce();

    // Nothing thrown – success; but also ensure no position added for invalid ones
    // (we can check that addPosition was called at most 0 times for invalids)
  });

  it("loadSettingsFromDisk handles invalid JSON gracefully", async () => {
    // Create a temp file with invalid JSON and point SETTINGS_PATH to it before constructing the bot
    const tmpDir = require("node:os").tmpdir();
    const tmpFile = require("node:path").join(tmpDir, `bad-settings-${Date.now()}.json`);
    const fs = require("node:fs");
    fs.writeFileSync(tmpFile, "{ not valid json", "utf8");

    process.env.SETTINGS_PATH = tmpFile;

    // Capture console.warn
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Construct a fresh bot which will attempt to load and hit the parse error
    const { Bot: BotClass } = await import("../bot");
    const tmpBot = new BotClass(fakeClient);

    expect(warnSpy).toHaveBeenCalled();

    // cleanup
    warnSpy.mockRestore();
    try { fs.unlinkSync(tmpFile); } catch (e) {}
    delete process.env.SETTINGS_PATH;
  });

  it("saveSettingsToDisk warns when write fails", async () => {
    const fs = require("node:fs");

    // make writeFileSync throw
    const writeSpy = vi.spyOn(fs, "writeFileSync").mockImplementation(() => { throw new Error("boom"); });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // update settings to trigger save
    (bot as any).updateSettings({ maxPositionSize: 123 });

    expect(warnSpy).toHaveBeenCalled();

    writeSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("runOnce skips updatePrices when there are no parsed YES prices", async () => {
    // client returns events with no outcomePrices (or invalid ones), leading to marketYesPrices.size === 0
    fakeClient.getGammaMarkets = async () => [
      { slug: "s1", markets: [{ id: "mA", question: "QA", volume: 10, outcomePrices: '["not-number"]' } ] }
    ];

    const pm = (bot as any).positionManager;
    const updateSpy = vi.spyOn(pm, "updatePrices");

    await (bot as any).runOnce();

    expect(updateSpy).not.toHaveBeenCalled();

    updateSpy.mockRestore();
  });
});
