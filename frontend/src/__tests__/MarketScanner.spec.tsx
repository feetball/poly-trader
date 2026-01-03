import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import MarketScanner from "@/components/MarketScanner";

function mockFetchOnce(data: any) {
  return vi.fn().mockResolvedValue({
    json: async () => data,
  } as any);
}

describe("MarketScanner", () => {
  it("renders loading state then markets", async () => {
    const markets = [
      {
        id: "m1",
        question: "Will it rain tomorrow?",
        probability: 0.63,
        volume: 123_000,
        tags: ["weather"],
      },
    ];

    const fetchMock = mockFetchOnce(markets);
    vi.stubGlobal("fetch", fetchMock);

    render(<MarketScanner />);

    expect(screen.getByText("Scanning Polymarket...")).toBeInTheDocument();
    expect(await screen.findByText("Will it rain tomorrow?")).toBeInTheDocument();
    expect(screen.getByText("63%")).toBeInTheDocument();
  });

  it("handles fetch error by clearing markets", async () => {
    vi.useFakeTimers();

    const fetchMock = vi.fn().mockRejectedValue(new Error("boom"));
    vi.stubGlobal("fetch", fetchMock);

    render(<MarketScanner />);

    // Initial empty state remains.
    expect(screen.getByText("Scanning Polymarket...")).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).toHaveBeenCalled();

    vi.useRealTimers();
  });
});
