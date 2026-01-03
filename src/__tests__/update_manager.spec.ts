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
});
