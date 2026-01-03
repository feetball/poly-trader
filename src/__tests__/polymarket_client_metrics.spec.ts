import { describe, expect, it, vi } from "vitest";

vi.mock("axios", () => {
  return {
    default: {
      get: vi.fn(async () => ({ data: [{ id: "ok" }] })),
    },
  };
});

import axios from "axios";
import { PolymarketClient } from "../clients/polymarket";

describe("PolymarketClient metrics", () => {
  it("prunes api call timestamps older than 60s", () => {
    const pc = Object.create(PolymarketClient.prototype) as PolymarketClient;
    const now = Date.now();
    (pc as any).apiCallTimestamps = [now - 61_000, now - 10_000, now - 1];

    const perMin = pc.getApiCallsPerMinute();
    expect(perMin).toBe(2);
  });

  it("records a call for getGammaMarkets", async () => {
    const pc = Object.create(PolymarketClient.prototype) as PolymarketClient;
    (pc as any).gammaApiUrl = "https://example.com";
    (pc as any).apiCallTimestamps = [];

    const res = await pc.getGammaMarkets({ limit: 1 });
    expect(Array.isArray(res)).toBe(true);
    expect((axios as any).get).toHaveBeenCalled();
    expect(((pc as any).apiCallTimestamps as number[]).length).toBe(1);
  });
});
