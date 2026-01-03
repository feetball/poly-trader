import { describe, it, expect, vi } from "vitest";
import { Bot } from "../bot";
import { PolymarketClient } from "../clients/polymarket";
import { MarketDataStream } from "../clients/websocket";
import { PositionManager } from "../managers/position_manager";

describe("Bot websocket integration", () => {
  it("maps asset ids to market ids and updates prices on price_update", async () => {
    // Fake client returning a market with clobTokenIds mapping to asset 'asset1'
    const fakeClient = {
      getGammaMarkets: vi.fn(async () => [
        {
          slug: "test-event",
          markets: [
            {
              id: "m1",
              question: "Test Market",
              volume: 100,
              outcomePrices: "[0.5, 0.5]",
              clobTokenIds: JSON.stringify(["asset1"]),
            },
          ],
        },
      ]),
    } as unknown as PolymarketClient;

    const bot = new Bot(fakeClient);

    // Spy on PositionManager.updatePrices
    const spy = vi.spyOn((bot as any).positionManager as PositionManager, "updatePrices");

    // Run one scan to build subscriptions and asset->market mapping
    await (bot as any).runOnce();

    // Ensure mapping exists
    const mapping = (bot as any).assetToMarkets.get("asset1");
    expect(mapping.has("m1")).toBe(true);

    // Emit a price_update event
    const mds: MarketDataStream = (bot as any).marketStream;
    mds.emit("price_update", { event_type: "price_change", asset_id: "asset1", price: "0.6" });

    // Expect updatePrices to be called with map containing m1 -> 0.6
    expect(spy).toHaveBeenCalled();
    const calledWith = spy.mock.calls[spy.mock.calls.length - 1][0] as Map<string, number>;
    expect(calledWith.get("m1")).toBeCloseTo(0.6, 6);

    spy.mockRestore();
  });
});