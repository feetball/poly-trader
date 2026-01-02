import { Strategy, StrategyContext, MarketOpportunity } from "./base";

export class ArbitrageStrategy extends Strategy {
  id = "arbitrage";
  name = "Complete-Set Arbitrage";
  description = "Exploits mispricing where YES + NO < 1.00 (Risk-Free Profit)";

  async analyze(context: StrategyContext): Promise<MarketOpportunity[]> {
    const opportunities: MarketOpportunity[] = [];
    
    // Fetch active markets from Gamma API
    const events = await context.client.getGammaMarkets({ 
      active: true, 
      closed: false, 
      limit: 50, 
      order: "volume24hr", 
      ascending: false
    });

    for (const event of events) {
      for (const market of event.markets) {
        try {
          if (!market.clobTokenIds || !market.active || market.closed) continue;

          const tokenIds = JSON.parse(market.clobTokenIds);
          if (tokenIds.length !== 2) continue; // Only handle binary markets

          const tokenYes = tokenIds[0];
          const tokenNo = tokenIds[1];

          // Fetch Orderbooks
          const [obYes, obNo] = await Promise.all([
            context.client.getOrderBook(tokenYes),
            context.client.getOrderBook(tokenNo)
          ]);

          if (!obYes || !obNo) continue;

          // 1. Edge Detection: Check if Best Ask (YES) + Best Ask (NO) < 1.00
          const bestAskYes = obYes.asks.length > 0 ? parseFloat(obYes.asks[0].price) : 1;
          const bestAskNo = obNo.asks.length > 0 ? parseFloat(obNo.asks[0].price) : 1;
          
          // Fee calculation (Polymarket takes fees on winnings, but entry is fee-free usually on CLOB maker, taker pays fee)
          // Assuming taker fee is ~0.1% or similar. We target a sum < 0.99 to be safe.
          const totalCost = bestAskYes + bestAskNo;
          const profitMargin = 1.0 - totalCost;

          if (totalCost < 0.995) { // 0.5% edge minimum
             // Calculate max size we can take
             const sizeYes = obYes.asks.length > 0 ? parseFloat(obYes.asks[0].size) : 0;
             const sizeNo = obNo.asks.length > 0 ? parseFloat(obNo.asks[0].size) : 0;
             const maxExecSize = Math.min(sizeYes, sizeNo);

             if (maxExecSize > 5) { // Minimum $5 size
                opportunities.push({
                  marketId: market.id,
                  question: market.question,
                  strategy: this.id,
                  outcome: "BOTH",
                  price: totalCost,
                  size: maxExecSize,
                  confidence: 1.0,
                  signalStrength: profitMargin * 100,
                  timestamp: Date.now(),
                  metadata: {
                    bestAskYes,
                    bestAskNo,
                    profitPotential: profitMargin,
                    type: "complete_set_arbitrage"
                  }
                });
             }
          }
        } catch (e) {
          console.error(`Error analyzing market ${market.id}:`, e);
        }
      }
    }

    return opportunities;
  }
}
