import { describe, expect, it, vi } from "vitest";

import { UpdateManager } from "../managers/UpdateManager";

describe("UpdateManager polling + version comparison", () => {
  it("compareVersions handles greater/less/equal and different lengths", () => {
    const um = new UpdateManager("1.0.0");
    const cmp = (um as any).compareVersions.bind(um);

    expect(cmp("1.0.0", "1.0.0")).toBe(0);
    expect(cmp("1.0.1", "1.0.0")).toBe(1);
    expect(cmp("1.0.0", "1.0.1")).toBe(-1);
    expect(cmp("1.2", "1.2.0")).toBe(0);
    expect(cmp("2", "1.9.9")).toBe(1);
  });

  it("startPolling is idempotent and stopPolling clears timer", async () => {
    vi.useFakeTimers();

    const um = new UpdateManager("1.0.0");
    const spy = vi.spyOn(um, "checkForUpdates").mockResolvedValue({
      hasUpdate: false,
      latestVersion: "1.0.0",
      downloadUrl: "",
      lastChecked: Date.now(),
    });

    um.startPolling(1000);
    um.startPolling(1000);

    // immediate check
    expect(spy).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(3000);
    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(3);

    um.stopPolling();
    const callsBefore = spy.mock.calls.length;

    vi.advanceTimersByTime(3000);
    expect(spy.mock.calls.length).toBe(callsBefore);

    vi.useRealTimers();
  });
});
