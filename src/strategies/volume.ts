import { Strategy, StrategyContext, MarketOpportunity } from "./base";

export class VolumeSpikeStrategy extends Strategy {
  id = "volume_spike";
  name = "Volume Spike / Momentum";
  description = "Detects rapid volume increases indicating breaking news";
  
  // Store previous volume to detect changes: marketId -> volume
  private volumeHistory: Map<string, number> = new Map();

  async analyze(context: StrategyContext): Promise<MarketOpportunity[]> {
    const opportunities: MarketOpportunity[] = [];
    
    // Fetch active markets
    const events = await context.client.getGammaMarkets({ 
      active: true, 
      closed: false, 
      limit: 50, 
      order: "volume24hr", 
      ascending: false 
    });

    for (const event of events) {
      for (const market of event.markets) {
        if (!market.active || market.closed) continue;

        const currentVolume = parseFloat(market.volume || "0");
        const previousVolume = this.volumeHistory.get(market.id) ?? currentVolume;
        
        // Update history
        this.volumeHistory.set(market.id, currentVolume);

        // Calculate volume change (if we have history)
        // Note: In the first run, change will be 0
        const volumeChange = currentVolume - previousVolume;
        
        // Thresholds (arbitrary for demo)
        // If volume increased by > $1000 in the last interval (5s)
        const isSpike = volumeChange > 1000; 
        
        // Also consider high 24h volume as a general momentum signal
        const isHighMomentum = market.volume24hr > 100000;

        if (isSpike || isHighMomentum) {
          // Determine direction based on price (simplified)
          // If price > 0.5, assume momentum is towards YES, else NO
          // In reality, we'd check price change direction too
          const prices = JSON.parse(market.outcomePrices || "[\"0.5\", \"0.5\"]");
          const priceYes = parseFloat(prices[0]);
          
          const outcome = priceYes > 0.5 ? "YES" : "NO";
          const confidence = isSpike ? 0.8 : 0.5;

          opportunities.push({
            marketId: market.id,
            question: market.question,
            outcome: outcome,
            price: priceYes,
            confidence: confidence,
            signalStrength: isSpike ? 90 : 60,
            timestamp: Date.now(),
            metadata: {
              volumeChange,
              volume24hr: market.volume24hr,
              isSpike
            }
          });
        }
      }
    }

    return opportunities;
  }
}
