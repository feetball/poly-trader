import { describe, expect, it, vi } from "vitest";

vi.mock("axios", () => {
  return {
    default: {
      get: vi.fn(async () => ({ data: [{ id: "evt" }] })),
    },
  };
});

import { PolymarketClient } from "../clients/polymarket";
import { ethers } from "ethers";

const DUMMY_PK = "0x0123456789012345678901234567890123456789012345678901234567890123";

describe("PolymarketClient", () => {
  it("tracks API calls across Gamma and CLOB methods", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const c = new PolymarketClient(DUMMY_PK, false);

    // inject a fake clob client
    (c as any).client = {
      getMarkets: vi.fn(async () => ({ markets: [] })),
      getOrderBook: vi.fn(async () => ({ asks: [] })),
      createOrder: vi.fn(async () => ({ orderID: "1" })),
    };

    expect(c.getApiCallsPerMinute()).toBe(0);

    await c.getGammaMarkets({ active: true });
    await c.getMarkets();
    await c.getOrderBook("token");
    await c.createOrder("token", 0.5, 10, "BUY" as any);

    expect(c.getApiCallsPerMinute()).toBe(4);

    // advance beyond 60s -> prunes
    vi.setSystemTime(new Date("2026-01-01T00:01:01.000Z"));
    expect(c.getApiCallsPerMinute()).toBe(0);

    vi.useRealTimers();
  });

  it("returns [] on Gamma API error", async () => {
    const axios = await import("axios");
    (axios as any).default.get = vi.fn(async () => {
      throw new Error("nope");
    });

    const c = new PolymarketClient(DUMMY_PK, true);
    const data = await c.getGammaMarkets({});
    expect(Array.isArray(data)).toBe(true);
  });

  it("throws when CLOB client is not initialized", async () => {
    const c = new PolymarketClient(DUMMY_PK, true);
    await expect(c.getMarkets()).rejects.toThrow("Client not initialized");
    await expect(c.getOrderBook("x")).rejects.toThrow("Client not initialized");
  });

  it("paper mode createOrder does not require initialized client", async () => {
    const c = new PolymarketClient(DUMMY_PK, true);
    const order = await c.createOrder("tok", 0.5, 2, "BUY" as any);
    expect(order.status).toBe("filled");
    expect(order.orderID).toContain("paper-");
  });

  it("real mode createOrder requires initialized client", async () => {
    const c = new PolymarketClient(DUMMY_PK, false);
    await expect(c.createOrder("x", 0.5, 1, "BUY" as any)).rejects.toThrow(
      "Client not initialized"
    );
  });

  it("getBalance returns paper balance in paper mode and formats real balance", async () => {
    const paper = new PolymarketClient(DUMMY_PK, true);
    const pb = await paper.getBalance();
    expect(typeof pb).toBe("string");

    const real = new PolymarketClient(DUMMY_PK, false);
    (real as any).signer = {
      address: "0xabc",
      getBalance: vi.fn(async () => ethers.BigNumber.from("1000000000000000000")),
    };
    const rb = await real.getBalance();
    expect(rb).toBe("1.0");
  });
});
