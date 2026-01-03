import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LogsPage from "@/app/logs/page";

function responseJson(data: any) {
  return { json: async () => data } as any;
}

describe("LogsPage", () => {
  it("loads and renders logs", async () => {
    const fetchMock = vi.fn(async (input: any) => {
      const url = String(input);
      if (url.includes("/api/logs")) {
        return responseJson({
          entries: [
            { ts: 1700000000000, level: "info", message: "hello" },
            { ts: 1700000001000, level: "error", message: "boom" },
            { ts: 1700000002000, level: "warn", message: "careful" },
            { ts: 1700000003000, level: "log", message: "plain" },
          ],
        });
      }
      return responseJson({});
    });

    vi.stubGlobal("fetch", fetchMock as any);

    if (!globalThis.navigator.clipboard) {
      Object.defineProperty(globalThis.navigator, "clipboard", {
        value: { writeText: vi.fn().mockResolvedValue(undefined as any) },
        configurable: true,
      });
    }

    render(<LogsPage />);

    expect(await screen.findByText(/4 entries/i)).toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();
    expect(screen.getByText("careful")).toBeInTheDocument();
    expect(screen.getByText("plain")).toBeInTheDocument();
  });

  it("can copy and clear logs", async () => {
    const fetchMock = vi.fn(async (input: any, init?: any) => {
      const url = String(input);
      if (url.includes("/api/logs") && (!init || init.method === undefined)) {
        return responseJson({
          entries: [{ ts: 1700000000000, level: "info", message: "hello" }],
        });
      }
      if (url.includes("/api/logs/clear")) {
        expect(init?.method).toBe("POST");
        return responseJson({ ok: true });
      }
      return responseJson({});
    });

    vi.stubGlobal("fetch", fetchMock as any);

    if (!globalThis.navigator.clipboard) {
      Object.defineProperty(globalThis.navigator, "clipboard", {
        value: { writeText: vi.fn().mockResolvedValue(undefined as any) },
        configurable: true,
      });
    }

    const user = userEvent.setup();
    render(<LogsPage />);

    expect(await screen.findByText(/1 entries/i)).toBeInTheDocument();
    expect(await screen.findByText("hello")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Copy/i }));

    await user.click(screen.getByRole("button", { name: /Clear/i }));

    await waitFor(() => {
      expect(screen.getByText(/No logs yet/i)).toBeInTheDocument();
    });
  });
});
