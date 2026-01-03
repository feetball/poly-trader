import { describe, expect, it, vi } from "vitest";

vi.mock("axios", () => {
  return {
    default: {
      post: vi.fn(async () => ({
        data: {
          data: {
            transactions: [
              {
                id: "t1",
                market: { id: "m1", question: "Q1" },
                outcomeIndex: "0",
                price: "0.5",
                amount: "10",
                timestamp: "1000",
                type: "BUY",
              },
              {
                id: "t2",
                market: { id: "m2", question: "Q2" },
                outcomeIndex: "1",
                price: "0.4",
                amount: "5",
                timestamp: "900",
                type: "SELL",
              },
            ],
          },
        },
      })),
    },
  };
});

import { UserAnalysisService } from "../services/user_analysis";

describe("UserAnalysisService", () => {
  it("fetches trades for a user", async () => {
    const svc = new UserAnalysisService();
    const trades = await svc.getUserTrades("0xabc");
    expect(trades.length).toBe(2);
    expect(trades[0].id).toBe("t1");
  });

  it("analyzes trade patterns", () => {
    const svc = new UserAnalysisService();
    const trades = [
      {
        id: "1",
        marketId: "m1",
        question: "Q",
        outcomeIndex: 0,
        price: 0.5,
        size: 10,
        timestamp: 1700000000, // deterministic
        type: "BUY" as const,
      },
      {
        id: "2",
        marketId: "m2",
        question: "Q",
        outcomeIndex: 0,
        price: 0.5,
        size: 5000,
        timestamp: 1700003600,
        type: "SELL" as const,
      },
    ];

    const info = svc.analyzePattern(trades);
    expect(info?.totalTrades).toBe(2);
    expect(info?.totalVolume).toBeCloseTo(0.5 * 10 + 0.5 * 5000);
    expect(info?.riskScore).toBe("HIGH");
    expect(typeof info?.peakTradingHour).toBe("number");
    expect(info?.lastActive).toBe(trades[0].timestamp);
  });

  it("analyzePattern returns null for empty trades", () => {
    const svc = new UserAnalysisService();
    expect(svc.analyzePattern([])).toBeNull();
  });

  it("analyzePattern can produce LOW risk", () => {
    const svc = new UserAnalysisService();
    const info = svc.analyzePattern([
      {
        id: "1",
        marketId: "m1",
        question: "Q",
        outcomeIndex: 0,
        price: 0.5,
        size: 1,
        timestamp: 1700000000,
        type: "BUY" as const,
      },
    ]);
    expect(info?.riskScore).toBe("LOW");
  });

  it("handles API errors gracefully", async () => {
    const axios = await import("axios");
    (axios as any).default.post = vi.fn(async () => {
      throw new Error("fail");
    });

    const svc = new UserAnalysisService();
    const trades = await svc.getUserTrades("0xabc");
    expect(trades).toEqual([]);
  });
});
