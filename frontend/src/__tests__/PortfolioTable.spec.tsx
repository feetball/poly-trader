import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PortfolioTable from "@/components/PortfolioTable";

function responseJson(data: any) {
  return { json: async () => data } as any;
}

describe("PortfolioTable", () => {
  it("supports legacy array response", async () => {
    const legacy = [
      {
        title: "Test Market",
        outcome: "YES",
        shares: 10,
        avgPrice: 0.4,
        currentPrice: 0.5,
        pnl: 1.23,
      },
    ];

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(responseJson(legacy)));

    render(<PortfolioTable />);

    expect(await screen.findByText("Test Market")).toBeInTheDocument();
    expect(screen.getByText("YES")).toBeInTheDocument();
    expect(screen.getByText("+1.23")).toBeInTheDocument();
  });

  it("supports new { positions, summary } response", async () => {
    const payload = {
      positions: [
        {
          title: "Another Market",
          outcome: "NO",
          shares: 5,
          avgPrice: 0.6,
          currentPrice: 0.55,
          pnl: -0.5,
        },
      ],
      summary: {
        totalUnrealizedPnL: -0.5,
        openWinners: 0,
        openLosers: 1,
      },
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(responseJson(payload)));

    render(<PortfolioTable />);

    expect(await screen.findByText("Another Market")).toBeInTheDocument();
    expect(screen.getByText("LOSS")).toBeInTheDocument();
    expect(screen.getByText("Losers:")).toBeInTheDocument();
  });

  it("renders WIN summary when PnL is positive", async () => {
    const payload = {
      positions: [
        {
          title: "Winning Market",
          outcome: "YES",
          shares: 1,
          avgPrice: 0.4,
          currentPrice: 0.9,
          pnl: 0.5,
        },
      ],
      summary: {
        totalUnrealizedPnL: 0.5,
        openWinners: 2,
        openLosers: 0,
      },
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(responseJson(payload)));

    render(<PortfolioTable />);

    expect(await screen.findByText("Winning Market")).toBeInTheDocument();
    expect(screen.getByText("WIN")).toBeInTheDocument();
    expect(screen.getByText("Winners:")).toBeInTheDocument();
  });

  it("handles fetch error", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("fail")));

    render(<PortfolioTable />);

    expect(screen.getByText("No active positions found")).toBeInTheDocument();

    vi.useRealTimers();
  });

  it("handles malformed object response", async () => {
    const payload = {
      positions: null,
      // summary omitted
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(responseJson(payload)));

    render(<PortfolioTable />);

    // Should fall back to empty list and show the empty-state row.
    expect(await screen.findByText("No active positions found")).toBeInTheDocument();
  });

  it("consumes SSE updates and updates the table", async () => {
    // stub fetch to return empty initially
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(responseJson({ positions: [], summary: null })));

    // Mock EventSource
    class MockEventSource {
      public onmessage: ((ev: any) => void) | null = null;
      public onerror: ((e: any) => void) | null = null;
      constructor(public url: string) {
        (MockEventSource as any).last = this;
      }
      close() { }
      // helper to dispatch messages
      dispatch(payload: any) {
        if (this.onmessage) this.onmessage({ data: JSON.stringify(payload) });
      }
    }

    // @ts-ignore
    vi.stubGlobal("EventSource", MockEventSource);

    render(<PortfolioTable />);

    // get the created instance and dispatch an update
    const inst = (MockEventSource as any).last as MockEventSource;
    expect(inst).toBeDefined();

    const payload = {
      positions: [
        { title: "Live Market", outcome: "YES", shares: 10, avgPrice: 0.4, currentPrice: 0.6, pnl: 2.0 },
      ],
      summary: { totalUnrealizedPnL: 2.0, openWinners: 1, openLosers: 0 },
    };

    inst.dispatch(payload);

    expect(await screen.findByText("Live Market")).toBeInTheDocument();
    expect(screen.getByText("WIN")).toBeInTheDocument();

    // cleanup
    // @ts-ignore
    (global as any).EventSource = undefined;
  });
});
