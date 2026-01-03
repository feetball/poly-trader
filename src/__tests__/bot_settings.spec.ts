import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Bot } from "../bot";

function makeTempSettingsPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "poly-trader-test-"));
  return { dir, file: path.join(dir, "settings.json") };
}

describe("Bot settings persistence", () => {
  it("sanitizes and persists settings to disk", () => {
    const { file } = makeTempSettingsPath();
    process.env.SETTINGS_PATH = file;

    const bot = new Bot({} as any);

    const updated = bot.updateSettings({
      scanIntervalMs: 10, // should clamp to 1000
      updownHoldMs: 999, // should clamp to 60_000
      enabledStrategies: ["  updown_15 ", "", 123 as any],
      maxPositionSize: -5,
    } as any);

    expect(updated.scanIntervalMs).toBe(1000);
    expect(updated.updownHoldMs).toBe(60_000);
    expect(updated.enabledStrategies).toEqual(["updown_15"]);
    expect(updated.maxPositionSize).toBe(0);

    expect(fs.existsSync(file)).toBe(true);
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw);
    expect(parsed.scanIntervalMs).toBe(1000);
    expect(parsed.updownHoldMs).toBe(60_000);

    delete process.env.SETTINGS_PATH;
  });

  it("loads settings from disk on startup", () => {
    const { file } = makeTempSettingsPath();
    fs.writeFileSync(
      file,
      JSON.stringify({ maxPositionSize: 123, scanIntervalMs: 2000, enabledStrategies: ["arbitrage"] }),
      "utf8"
    );
    process.env.SETTINGS_PATH = file;

    const bot = new Bot({} as any);
    const settings = bot.getSettings();

    expect(settings.maxPositionSize).toBe(123);
    expect(settings.scanIntervalMs).toBe(2000);
    expect(settings.enabledStrategies).toEqual(["arbitrage"]);

    delete process.env.SETTINGS_PATH;
  });
});
