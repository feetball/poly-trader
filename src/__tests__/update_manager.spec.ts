import { describe, expect, it, vi } from "vitest";

vi.mock("axios", () => {
  return {
    default: {
      get: vi.fn(async () => ({
        data: {
          tag_name: "v1.2.3",
          html_url: "https://example.com/release",
        },
      })),
    },
  };
});

import { UpdateManager } from "../managers/UpdateManager";

describe("UpdateManager", () => {
  it("detects available updates", async () => {
    const um = new UpdateManager("1.0.0");
    const info = await um.checkForUpdates();

    expect(info.hasUpdate).toBe(true);
    expect(info.latestVersion).toBe("1.2.3");
    expect(info.downloadUrl).toContain("release");
    expect(typeof info.lastChecked).toBe("number");

    const cached = um.getLatestInfo();
    expect(cached.latestVersion).toBe("1.2.3");
  });

  it("returns cached info on failure", async () => {
    const um = new UpdateManager("1.0.0");

    // first call succeeds
    await um.checkForUpdates();

    // then force failure
    const axios = await import("axios");
    (axios as any).default.get = vi.fn(async () => {
      throw new Error("boom");
    });

    const info = await um.checkForUpdates();
    expect(info.latestVersion).toBe("1.2.3");
    expect(info.lastChecked).toBeDefined();
  });

  it("emits 'update' event on successful check and getLatestInfo reflects it", async () => {
    const um = new UpdateManager("1.0.0");
    const handler = vi.fn();
    um.on("update", handler);

    const axios = await import("axios");
    (axios as any).default.get = vi.fn(async () => ({ data: { tag_name: "v9.9.9", html_url: "u" } }));

    const info = await um.checkForUpdates();
    // allow any async handler scheduling to complete
    await Promise.resolve();
    expect(handler).toHaveBeenCalled();
    expect(um.getLatestInfo().latestVersion).toBe(info.latestVersion);
  });

  it("startPolling default interval invokes checks and stopPolling clears it", async () => {
    vi.useFakeTimers();

    const axios = await import("axios");
    const getSpy = vi.spyOn((axios as any).default, "get").mockResolvedValue({ data: { tag_name: "v1.0.0", html_url: "u" } });

    const um = new UpdateManager("1.0.0");
    um.startPolling(); // default interval

    // immediate check (at least one call has occurred)
    expect(getSpy.mock.calls.length).toBeGreaterThanOrEqual(1);

    // advance one minute
    vi.advanceTimersByTime(60 * 1000);
    // setInterval default is 5 minutes; so it should not have called again yet
    expect(getSpy.mock.calls.length).toBeGreaterThanOrEqual(1);

    // advance 5 minutes to trigger interval-based call
    vi.advanceTimersByTime(5 * 60 * 1000);
    expect(getSpy.mock.calls.length).toBeGreaterThanOrEqual(2);

    um.stopPolling();

    const callsBefore = getSpy.mock.calls.length;
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(getSpy.mock.calls.length).toBe(callsBefore);

    getSpy.mockRestore();
    vi.useRealTimers();
  });

  it("stopPolling is safe to call when not polling", () => {
    const um = new UpdateManager("1.0.0");
    // should not throw
    um.stopPolling();
  });

  it("no update detected when latest version is equal or lower", async () => {
    const um = new UpdateManager("1.2.3");

    const axios = await import("axios");
    (axios as any).default.get = vi.fn(async () => ({ data: { tag_name: "v1.2.3", html_url: "u" } }));

    const info = await um.checkForUpdates();
    expect(info.hasUpdate).toBe(false);
    expect(um.getLatestInfo().latestVersion).toBe("1.2.3");
  });

  it("getLatestInfo returns initial version before checks", () => {
    const um = new UpdateManager("2.0.0");
    const info = um.getLatestInfo();
    expect(info.latestVersion).toBe("2.0.0");
    expect(info.hasUpdate).toBe(false);
  });

  it("ping returns pong", () => {
    const um = new UpdateManager("1.0.0");
    expect(um.ping()).toBe("pong");
  });
});
