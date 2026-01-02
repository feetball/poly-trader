import { UpDown15Strategy } from "../src/strategies/updown15";

// Mock PolymarketClient with only getGammaMarkets implemented
const fakeClient = {
  async getGammaMarkets() {
    return [
      {
        markets: [
          {
            id: "test-mkt",
            question: "Test Up/Down Market",
            active: true,
            closed: false,
            outcomePrices: JSON.stringify(["0.45","0.55"]),
            volume24hr: 5000
          }
        ]
      }
    ];
  }
};

(async () => {
  const strat = new UpDown15Strategy();

  // Seed history to simulate an upward move over 15 minutes
  const oldTs = Date.now() - 15 * 60 * 1000 + 2000; // ~15m ago but within window
  (strat as any).priceHistory.set("test-mkt", [ { ts: oldTs, price: 0.35 } ]);

  const context = {
    client: fakeClient as any,
    settings: {
      minLiquidity: 1000,
      maxPositionSize: 50
    }
  };

  const opps = await strat.analyze(context as any);
  console.log("Opportunities:", opps);
})();
