import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardLayout } from "@/components/DashboardLayout";

function responseJson(data: any) {
  return { json: async () => data } as any;
}

describe("DashboardLayout", () => {
  it("renders version + metrics and can toggle bot", async () => {
    const fetchMock = vi.fn(async (input: any, init?: any) => {
      const url = String(input);

      if (url.includes("/api/status")) return responseJson({ status: "running" });
      if (url.includes("/api/version")) return responseJson({ currentVersion: "1.2.3" });
      if (url.includes("/api/metrics"))
        return responseJson({ apiCallsPerMinute: 12, scanIntervalMs: 5000, ts: Date.now() });

      if (url.includes("/api/bot/stop")) {
        expect(init?.method).toBe("POST");
        return responseJson({ ok: true });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock as any);

    render(
      <DashboardLayout>
        <div>Child content</div>
      </DashboardLayout>
    );

    expect(await screen.findByText("v1.2.3")).toBeInTheDocument();
    expect(screen.getByText("Child content")).toBeInTheDocument();

    expect(screen.getByText(/API\/min: 12/)).toBeInTheDocument();
    expect(screen.getByText(/Scan: 5\.0s/)).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Stop Engine/i }));

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/bot/stop"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("handles offline status fetch failure", async () => {
    const fetchMock = vi.fn(async (input: any) => {
      const url = String(input);
      if (url.includes("/api/status")) throw new Error("offline");
      if (url.includes("/api/version")) return responseJson({ currentVersion: "0.0.1" });
      if (url.includes("/api/metrics")) return responseJson({ apiCallsPerMinute: 0, scanIntervalMs: 1000, ts: Date.now() });
      return responseJson({});
    });
    vi.stubGlobal("fetch", fetchMock as any);

    render(
      <DashboardLayout>
        <div>Child</div>
      </DashboardLayout>
    );

    expect(await screen.findByText("v0.0.1")).toBeInTheDocument();
    expect(screen.getAllByText(/Offline/i).length).toBeGreaterThan(0);
  });

  it("handles version/metrics fetch failure", async () => {
    const fetchMock = vi.fn(async (input: any) => {
      const url = String(input);
      if (url.includes("/api/status")) return responseJson({ status: "running" });
      if (url.includes("/api/version")) throw new Error("no version");
      if (url.includes("/api/metrics")) throw new Error("no metrics");
      return responseJson({});
    });

    vi.stubGlobal("fetch", fetchMock as any);

    render(
      <DashboardLayout>
        <div>Child</div>
      </DashboardLayout>
    );

    expect(await screen.findByText("unknown")).toBeInTheDocument();
    expect(screen.getByText(/API\/min: --/)).toBeInTheDocument();
    expect(screen.getByText(/Scan: --s/)).toBeInTheDocument();
  });
});
