import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SettingsPanel from "@/components/SettingsPanel";

function responseJson(data: any) {
  return { json: async () => data } as any;
}

describe("SettingsPanel", () => {
  it("loads settings and can save changes", async () => {
    const initialSettings = {
      maxPositionSize: 50,
      stopLossPercentage: 10,
      takeProfitPercentage: 20,
      enabledStrategies: ["arbitrage"],
      scanIntervalMs: 5000,
      updownHoldMs: 900000,
    };

    const fetchMock = vi.fn(async (input: any, init?: any) => {
      const url = String(input);

      if (url.includes("/api/settings") && (!init || init.method === undefined)) {
        return responseJson(initialSettings);
      }
      if (url.includes("/api/version")) {
        return responseJson({ currentVersion: "1.2.3", latestVersion: "1.2.3" });
      }
      if (url.includes("/api/wallet")) {
        return responseJson({ balance: 1234.56 });
      }
      if (url.includes("/api/settings") && init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        // Save should include the edited values.
        expect(body.scanIntervalMs).toBe(2000);
        expect(body.updownHoldMs).toBe(600000);
        return responseJson(body);
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock as any);

    render(<SettingsPanel />);

    expect(await screen.findByText("Configuration")).toBeInTheDocument();
    expect(screen.getByText("$1234.56")).toBeInTheDocument();

    const holdLabel = screen.getByText(/Up\/Down Hold \(minutes\)/i);
    const holdInput = holdLabel.parentElement?.querySelector("input") as HTMLInputElement | null;
    if (!holdInput) throw new Error("Hold input not found");
    fireEvent.change(holdInput, { target: { value: "10" } });

    const scanLabel = screen.getByText(/Scan Interval \(seconds\)/i);
    const scanInput = scanLabel.parentElement?.querySelector("input") as HTMLInputElement | null;
    if (!scanInput) throw new Error("Scan input not found");
    fireEvent.change(scanInput, { target: { value: "2" } });

    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => {
      expect(screen.getByText("Saved")).toBeInTheDocument();
    });
  });

  it("shows fallback settings when settings fetch fails", async () => {
    const fetchMock = vi.fn(async (input: any) => {
      const url = String(input);
      if (url.includes("/api/settings")) throw new Error("fail");
      if (url.includes("/api/version")) return responseJson({ currentVersion: "0.0.1" });
      if (url.includes("/api/wallet")) return responseJson({ balance: 100 });
      return responseJson({});
    });

    vi.stubGlobal("fetch", fetchMock as any);

    render(<SettingsPanel />);

    expect(await screen.findByText("Configuration")).toBeInTheDocument();
    // Fallback enables arbitrage only.
    expect(screen.getByText(/arbitrage/i)).toBeInTheDocument();
  });

  it("can reset wallet", async () => {
    const initialSettings = {
      maxPositionSize: 50,
      stopLossPercentage: 10,
      takeProfitPercentage: 20,
      enabledStrategies: ["arbitrage"],
      scanIntervalMs: 5000,
      updownHoldMs: 900000,
    };

    const fetchMock = vi.fn(async (input: any, init?: any) => {
      const url = String(input);
      if (url.includes("/api/settings") && (!init || init.method === undefined)) {
        return responseJson(initialSettings);
      }
      if (url.includes("/api/version")) {
        return responseJson({ currentVersion: "1.2.3" });
      }
      if (url.includes("/api/wallet")) {
        return responseJson({ balance: 50 });
      }
      if (url.includes("/api/reset-all")) {
        expect(init?.method).toBe("POST");
        return responseJson({ balance: 10000 });
      }
      return responseJson({});
    });

    vi.stubGlobal("fetch", fetchMock as any);

    const user = userEvent.setup();
    render(<SettingsPanel />);

    expect(await screen.findByText("$50.00")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Reset$/i }));

    expect(await screen.findByText("$10000.00")).toBeInTheDocument();
    expect(screen.getByText(/reset to defaults/i)).toBeInTheDocument();
  });

  it("renders update available link and can check for updates", async () => {
    const initialSettings = {
      maxPositionSize: 50,
      stopLossPercentage: 10,
      takeProfitPercentage: 20,
      enabledStrategies: ["arbitrage"],
      scanIntervalMs: 5000,
      updownHoldMs: 900000,
    };

    const fetchMock = vi.fn(async (input: any, init?: any) => {
      const url = String(input);
      if (url.includes("/api/settings") && (!init || init.method === undefined)) {
        return responseJson(initialSettings);
      }
      if (url.includes("/api/version")) {
        return responseJson({
          currentVersion: "1.0.0",
          hasUpdate: true,
          latestVersion: "1.1.0",
          downloadUrl: "https://example.test/download",
          lastChecked: 1700000000000,
        });
      }
      if (url.includes("/api/wallet")) {
        return responseJson({ balance: 100 });
      }
      if (url.includes("/api/check-update")) {
        expect(init?.method).toBe("POST");
        return responseJson({ hasUpdate: false, latestVersion: "1.1.0", lastChecked: 1700000001000 });
      }
      return responseJson({});
    });

    vi.stubGlobal("fetch", fetchMock as any);

    const user = userEvent.setup();
    render(<SettingsPanel />);

    expect(await screen.findByText(/Bot v1\.0\.0/i)).toBeInTheDocument();
    expect(screen.getByText(/Update Available/i)).toBeInTheDocument();
    expect(screen.getByText(/Last checked:/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Check for updates/i }));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/check-update"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("covers defaults when scan/hold values are invalid", async () => {
    const weirdSettings = {
      maxPositionSize: 50,
      stopLossPercentage: 10,
      takeProfitPercentage: 20,
      enabledStrategies: [],
      scanIntervalMs: "not-a-number",
      updownHoldMs: "not-a-number",
    };

    const fetchMock = vi.fn(async (input: any) => {
      const url = String(input);
      if (url.includes("/api/settings")) return responseJson(weirdSettings);
      if (url.includes("/api/version")) return responseJson({ currentVersion: "1.0.0" });
      if (url.includes("/api/wallet")) return responseJson({ balance: 0 });
      return responseJson({});
    });

    vi.stubGlobal("fetch", fetchMock as any);
    render(<SettingsPanel />);

    expect(await screen.findByText("Configuration")).toBeInTheDocument();

    const holdLabel = screen.getByText(/Up\/Down Hold \(minutes\)/i);
    const holdInput = holdLabel.parentElement?.querySelector("input") as HTMLInputElement | null;
    if (!holdInput) throw new Error("Hold input not found");
    expect(holdInput.value).toBe("15");

    const scanLabel = screen.getByText(/Scan Interval \(seconds\)/i);
    const scanInput = scanLabel.parentElement?.querySelector("input") as HTMLInputElement | null;
    if (!scanInput) throw new Error("Scan input not found");
    expect(scanInput.value).toBe("5");
  });

  it("handles save and reset failures", async () => {
    const initialSettings = {
      maxPositionSize: 50,
      stopLossPercentage: 10,
      takeProfitPercentage: 20,
      enabledStrategies: ["arbitrage"],
      scanIntervalMs: 5000,
      updownHoldMs: 900000,
    };

    const fetchMock = vi.fn(async (input: any, init?: any) => {
      const url = String(input);
      if (url.includes("/api/settings") && (!init || init.method === undefined)) {
        return responseJson(initialSettings);
      }
      if (url.includes("/api/version")) return responseJson({ currentVersion: "1.0.0" });
      if (url.includes("/api/wallet")) return responseJson({ balance: 100 });
      if (url.includes("/api/settings") && init?.method === "POST") throw new Error("save failed");
      if (url.includes("/api/reset-all")) throw new Error("reset failed");
      return responseJson({});
    });

    vi.stubGlobal("fetch", fetchMock as any);

    const user = userEvent.setup();
    render(<SettingsPanel />);

    expect(await screen.findByText("Configuration")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Save Changes/i }));
    expect(await screen.findByText(/Save failed/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Reset$/i }));
    expect(await screen.findByText(/Reset failed/i)).toBeInTheDocument();
  });

  it("does not render reset button when wallet balance is null", async () => {
    const initialSettings = {
      maxPositionSize: 50,
      stopLossPercentage: 10,
      takeProfitPercentage: 20,
      enabledStrategies: ["arbitrage"],
      scanIntervalMs: 5000,
      updownHoldMs: 900000,
    };

    const fetchMock = vi.fn(async (input: any) => {
      const url = String(input);
      if (url.includes("/api/settings")) return responseJson(initialSettings);
      if (url.includes("/api/version")) return responseJson({ currentVersion: "1.0.0" });
      if (url.includes("/api/wallet")) throw new Error("wallet unavailable");
      return responseJson({});
    });

    vi.stubGlobal("fetch", fetchMock as any);
    render(<SettingsPanel />);

    expect(await screen.findByText("Configuration")).toBeInTheDocument();
    
    // Reset button should not be visible when wallet fails to load
    const resetButtons = screen.queryAllByRole("button", { name: /^Reset$/i });
    expect(resetButtons).toHaveLength(0);
  });

  it("can toggle strategy checkboxes", async () => {
    const initialSettings = {
      maxPositionSize: 100,
      stopLossPercentage: 5,
      takeProfitPercentage: 15,
      enabledStrategies: [],
      scanIntervalMs: 5000,
      updownHoldMs: 900000,
    };

    const fetchMock = vi.fn(async (input: any) => {
      const url = String(input);
      if (url.includes("/api/settings")) return responseJson(initialSettings);
      if (url.includes("/api/version")) return responseJson({ currentVersion: "1.0.0" });
      if (url.includes("/api/wallet")) return responseJson({ balance: 200 });
      return responseJson({});
    });

    vi.stubGlobal("fetch", fetchMock as any);
    const user = userEvent.setup();
    render(<SettingsPanel />);

    expect(await screen.findByText("Configuration")).toBeInTheDocument();

    // Find and click an arbitrage checkbox
    const arbitrageCheckbox = screen.getByRole("checkbox", { name: /arbitrage/i }) as HTMLInputElement;
    expect(arbitrageCheckbox.checked).toBe(false);
    
    await user.click(arbitrageCheckbox);
    expect(arbitrageCheckbox.checked).toBe(true);

    // Uncheck it
    await user.click(arbitrageCheckbox);
    expect(arbitrageCheckbox.checked).toBe(false);
  });
});
