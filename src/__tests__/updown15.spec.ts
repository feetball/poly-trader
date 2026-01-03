import { describe, it, expect, vi } from "vitest";
import { UpDown15Strategy } from "../strategies/updown15";

describe("UpDown15Strategy branches", () => {
  it("skips markets that are inactive, closed, or missing outcomePrices", async () => {
    const client = {
      getGammaMarkets: async () => [
        { markets: [ { id: "m1", question: "Q", active: false, closed: false }, { id: "m2", question: "Q2", active: true, closed: true }, { id: "m3", question: "Q3", active: true, closed: false, /* no outcomePrices */ } ] }
      ]
    };

    const strat = new UpDown15Strategy();
    const out = await strat.analyze({ client: client as any, settings: {} as any });
    expect(Array.isArray(out)).toBe(true);
    expect(out.length).toBe(0);
  });

  it("continues and logs on invalid outcomePrices JSON", async () => {
    const client = {
      getGammaMarkets: async () => [ { markets: [ { id: "mBad", question: "Bad", active: true, closed: false, outcomePrices: 'not json' } ] } ]
    };

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const strat = new UpDown15Strategy();
    const out = await strat.analyze({ client: client as any, settings: {} as any });
    expect(out.length).toBe(0);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("skips when parsed price is NaN", async () => {
    const client = { getGammaMarkets: async () => [ { markets: [ { id: "mN", question: "N", active: true, closed: false, outcomePrices: '["NaN"]' } ] } ] };
    const strat = new UpDown15Strategy();
    const out = await strat.analyze({ client: client as any, settings: {} as any });
    expect(out.length).toBe(0);
  });

  it("produces a YES opportunity when price rises sufficiently and respects volume and size caps", async () => {
    const strat = new UpDown15Strategy();
    // seed history with an older point (1 minute ago) so elapsed >= MIN_EVAL_MS
    const now = Date.now();
    (strat as any).priceHistory.set("mUp", [{ ts: now - 60_000, price: 0.5 }]);

    const client = {
      getGammaMarkets: async () => [ { markets: [ { id: "mUp", question: "UpQ", active: true, closed: false, outcomePrices: '["0.6"]', volume24hr: 5000 } ] } ]
    };

    const settings = { minLiquidity: 1000, maxPositionSize: 10 } as any;

    const out = await strat.analyze({ client: client as any, settings });
    expect(out.length).toBeGreaterThan(0);
    const opp = out[0];
    expect(opp.outcome).toBe("YES");
    expect(opp.price).toBeCloseTo(0.6, 3);
    expect(opp.size).toBeLessThanOrEqual(settings.maxPositionSize);
    expect(opp.confidence).toBeGreaterThanOrEqual(0);
  });

  it("produces a NO opportunity when price falls (price computed as 1 - latest) and low volume prevents signals", async () => {
    const strat = new UpDown15Strategy();
    const now = Date.now();
    (strat as any).priceHistory.set("mDown", [{ ts: now - 60_000, price: 0.6 }]);

    const client = {
      getGammaMarkets: async () => [ { markets: [ { id: "mDown", question: "DownQ", active: true, closed: false, outcomePrices: '["0.5"]', volume24hr: 0 } ] } ]
    };

    // low volume should prevent signaling
    const outLow = await strat.analyze({ client: client as any, settings: { minLiquidity: 10000 } as any });
    expect(outLow.length).toBe(0);

    // with sufficient volume we should get a NO signal
    const outHigh = await strat.analyze({ client: { getGammaMarkets: async () => [ { markets: [ { id: "mDown", question: "DownQ", active: true, closed: false, outcomePrices: '["0.5"]', volume24hr: 5000 } ] } ] } as any, settings: { minLiquidity: 1000 } as any });
    expect(outHigh.length).toBeGreaterThan(0);
    const opp = outHigh[0];
    expect(opp.outcome).toBe("NO");
    expect(opp.price).toBeCloseTo(1 - 0.5, 3);
  });

  it("handles client errors gracefully and logs error", async () => {
    const client = { getGammaMarkets: async () => { throw new Error("boom"); } };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const strat = new UpDown15Strategy();
    const out = await strat.analyze({ client: client as any, settings: {} as any });
    expect(out.length).toBe(0);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
