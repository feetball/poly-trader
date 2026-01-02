import { Strategy, StrategyContext, MarketOpportunity } from "./base";

export class ArbitrageStrategy extends Strategy {
  id = "arbitrage";
  name = "Arbitrage Detection";
  description = "Detects when YES + NO prices < 1.00 (Risk-Free Profit)";

  async analyze(context: StrategyContext): Promise<MarketOpportunity[]> {
    const opportunities: MarketOpportunity[] = [];
    
    // Fetch active markets from Gamma API
    // We filter for active, open markets with some liquidity to avoid junk
    const events = await context.client.getGammaMarkets({ 
      active: true, 
      closed: false, 
      limit: 20, // Limit to 20 events to avoid rate limits during analysis
      order: "volume24hr", // Prioritize high volume markets
      ascending: false
    });

    for (const event of events) {
      for (const market of event.markets) {
        try {
          if (!market.clobTokenIds || !market.active || market.closed) continue;

          const tokenIds = JSON.parse(market.clobTokenIds);
          if (tokenIds.length !== 2) continue; // Only handle binary markets for now

          const tokenYes = tokenIds[0];
          const tokenNo = tokenIds[1];

          // Fetch Orderbooks for both sides
          // In a real high-frequency bot, we would use WebSocket streams instead of REST
          const [obYes, obNo] = await Promise.all([
            context.client.getOrderBook(tokenYes),
            context.client.getOrderBook(tokenNo)
          ]);

          if (!obYes || !obNo) continue;

          // Get Best Asks (Lowest price to buy)
          const bestAskYes = obYes.asks.length > 0 ? parseFloat(obYes.asks[0].price) : 1;
          const bestAskNo = obNo.asks.length > 0 ? parseFloat(obNo.asks[0].price) : 1;

          const totalCost = bestAskYes + bestAskNo;

          // Arbitrage Condition: Cost < 1.00 (ignoring fees for simplicity, but usually fees are ~0.1-0.2%)
          // We use 0.99 to be safe and cover fees/slippage
          if (totalCost < 0.99) {
            const profit = 1.0 - totalCost;
            
            opportunities.push({
              marketId: market.id,
              question: market.question,
              outcome: "BOTH", // Buy both sides
              price: totalCost,
              confidence: 1.0, // It's math, so high confidence
              signalStrength: profit * 100, // Signal strength is profit percentage
              timestamp: Date.now(),
              metadata: {
                bestAskYes,
                bestAskNo,
                profitPotential: profit
              }
            });
          }
        } catch (e) {
          console.error(`Error analyzing market ${market.id}:`, e);
        }
      }
    }

    return opportunities;
  }
}
