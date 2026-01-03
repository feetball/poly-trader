import { describe, expect, it, vi } from "vitest";
import { ArbitrageStrategy } from "../strategies/arbitrage";
import { VolumeSpikeStrategy } from "../strategies/volume";
import { UpDown15Strategy } from "../strategies/updown15";
import "../strategies/base";

describe("Strategies", () => {
  it("VolumeSpikeStrategy emits opportunities on spikes", async () => {
    const strat = new VolumeSpikeStrategy();

    const client = {
      getGammaMarkets: vi.fn(async () => [
        {
          markets: [
            {
              id: "m1",
              question: "Q",
              active: true,
              closed: false,
              volume: "0",
              volume24hr: 0,
              outcomePrices: '["0.6","0.4"]',
            },
          ],
        },
      ]),
    };

    const ctx = { client: client as any, settings: {} };

    // First run seeds history
    let opps = await strat.analyze(ctx as any);
    expect(opps).toEqual([]);

    // Second run spikes volume
    (client.getGammaMarkets as any).mockResolvedValueOnce([
      {
        markets: [
          {
            id: "m1",
            question: "Q",
            active: true,
            closed: false,
            volume: "2000",
            volume24hr: 0,
            outcomePrices: '["0.6","0.4"]',
          },
        ],
      },
    ]);

    opps = await strat.analyze(ctx as any);
    expect(opps.length).toBe(1);
    expect(opps[0].marketId).toBe("m1");
  });

  it("ArbitrageStrategy finds complete-set edge", async () => {
    const strat = new ArbitrageStrategy();

    const client = {
      getGammaMarkets: vi.fn(async () => [
        {
          markets: [
            {
              id: "m1",
              question: "Q",
              active: true,
              closed: false,
              clobTokenIds: '["YES","NO"]',
            },
          ],
        },
      ]),
      getOrderBook: vi.fn(async (tokenId: string) => {
        if (tokenId === "YES") return { asks: [{ price: "0.49", size: "20" }] };
        return { asks: [{ price: "0.49", size: "20" }] };
      }),
    };

    const ctx = { client: client as any, settings: {} };
    const opps = await strat.analyze(ctx as any);
    expect(opps.length).toBe(1);
    expect(opps[0].outcome).toBe("BOTH");
  });

  it("ArbitrageStrategy skips invalid/unprofitable markets", async () => {
    const strat = new ArbitrageStrategy();

    const client = {
      getGammaMarkets: vi.fn(async () => [
        {
          markets: [
            // missing clobTokenIds
            { id: "m0", question: "Q0", active: true, closed: false },
            // invalid JSON
            { id: "mBad", question: "QB", active: true, closed: false, clobTokenIds: "not json" },
            // not binary
            {
              id: "m3",
              question: "Q3",
              active: true,
              closed: false,
              clobTokenIds: '["A","B","C"]',
            },
            // no orderbook
            {
              id: "mNoOb",
              question: "Q4",
              active: true,
              closed: false,
              clobTokenIds: '["YES","NO"]',
            },
            // unprofitable (asks empty => bestAsk=1)
            {
              id: "mUnprof",
              question: "Q5",
              active: true,
              closed: false,
              clobTokenIds: '["Y","N"]',
            },
            // profitable but too small size
            {
              id: "mTiny",
              question: "Q6",
              active: true,
              closed: false,
              clobTokenIds: '["TYES","TNO"]',
            },
          ],
        },
      ]),
      getOrderBook: vi.fn(async (tokenId: string) => {
        if (tokenId === "YES" || tokenId === "NO") return null;
        if (tokenId === "Y" || tokenId === "N") return { asks: [] };
        if (tokenId === "TYES") return { asks: [{ price: "0.49", size: "1" }] };
        if (tokenId === "TNO") return { asks: [{ price: "0.49", size: "1" }] };
        return { asks: [{ price: "0.6", size: "20" }] };
      }),
    };

    const opps = await strat.analyze({ client: client as any, settings: {} } as any);
    expect(opps).toEqual([]);
  });

  it("UpDown15Strategy emits after ~15min window", async () => {
    vi.useFakeTimers();
    const strat = new UpDown15Strategy();

    const client = {
      getGammaMarkets: vi.fn(async () => [
        {
          markets: [
            {
              id: "m1",
              question: "Q",
              active: true,
              closed: false,
              volume24hr: 5000,
              outcomePrices: '["0.50","0.50"]',
            },
          ],
        },
      ]),
    };

    const ctx = { client: client as any, settings: { minLiquidity: 10000, maxPositionSize: 50 } };

    vi.setSystemTime(new Date("2026-01-02T00:00:00.000Z"));
    let opps = await strat.analyze(ctx as any);
    expect(opps).toEqual([]);

    // Advance <15 min (so history isn't pruned) and move price
    (client.getGammaMarkets as any).mockResolvedValueOnce([
      {
        markets: [
          {
            id: "m1",
            question: "Q",
            active: true,
            closed: false,
            volume24hr: 5000,
            outcomePrices: '["0.55","0.45"]',
          },
        ],
      },
    ]);

    vi.setSystemTime(new Date("2026-01-02T00:14:00.000Z"));
    opps = await strat.analyze(ctx as any);

    expect(opps.length).toBe(1);
    expect(opps[0].outcome).toBe("YES");

    vi.useRealTimers();
  });

  it("UpDown15Strategy guards against missing/invalid prices and insufficient data", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-02T00:00:00.000Z"));

    const strat = new UpDown15Strategy();
    const client = {
      getGammaMarkets: vi.fn(async () => [
        {
          markets: [
            { id: "m0", question: "Q", active: false, closed: false, outcomePrices: '["0.5","0.5"]', volume24hr: 9999 },
            { id: "m1", question: "Q", active: true, closed: false, volume24hr: 9999 }, // missing outcomePrices
            { id: "m2", question: "Q", active: true, closed: false, outcomePrices: "not json", volume24hr: 9999 },
            { id: "m3", question: "Q", active: true, closed: false, outcomePrices: '["NaN","0.5"]', volume24hr: 9999 },
            { id: "m4", question: "Q", active: true, closed: false, outcomePrices: '["0.50","0.50"]', volume24hr: 1 },
          ],
        },
      ]),
    };

    // first call seeds history (but will skip most entries)
    let opps = await strat.analyze({ client: client as any, settings: { minLiquidity: 10000, maxPositionSize: 50 } } as any);
    expect(opps).toEqual([]);

    // second call within <1m => insufficient elapsed for any market that did record
    vi.setSystemTime(new Date("2026-01-02T00:00:30.000Z"));
    opps = await strat.analyze({ client: client as any, settings: { minLiquidity: 10000, maxPositionSize: 50 } } as any);
    expect(opps).toEqual([]);

    vi.useRealTimers();
  });

  it("VolumeSpikeStrategy can trigger on high momentum without a spike", async () => {
    const strat = new VolumeSpikeStrategy();
    const client = {
      getGammaMarkets: vi.fn(async () => [
        {
          markets: [
            { id: "m0", question: "Q0", active: false, closed: false, volume: "0", volume24hr: 200000 },
            { id: "m1", question: "Q1", active: true, closed: false, volume: "10", volume24hr: 200000 },
          ],
        },
      ]),
    };

    const opps = await strat.analyze({ client: client as any, settings: {} } as any);
    expect(opps.length).toBe(1);
    expect(opps[0].marketId).toBe("m1");
  });
});
