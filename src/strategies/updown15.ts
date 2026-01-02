import { Strategy, StrategyContext, MarketOpportunity } from "./base";

export class UpDown15Strategy extends Strategy {
  id = "updown_15";
  name = "15-Minute Up/Down Momentum";
  description = "Detects strong 15-minute directional moves and signals YES or NO accordingly";

  private priceHistory: Map<string, { ts: number; price: number }[]> = new Map();
  private readonly WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  private readonly MIN_PERCENT_CHANGE = 0.03; // 3%

  async analyze(context: StrategyContext): Promise<MarketOpportunity[]> {
    const opportunities: MarketOpportunity[] = [];

    try {
      const events = await context.client.getGammaMarkets({
        active: true,
        closed: false,
        limit: 50,
        order: "volume24hr",
        ascending: false,
      });

      const now = Date.now();

      for (const event of events) {
        for (const market of event.markets || []) {
          try {
            if (!market.active || market.closed) continue;
            if (!market.outcomePrices) continue;

            const prices = JSON.parse(market.outcomePrices || "[\"0.5\",\"0.5\"]");
            const priceYes = parseFloat(prices[0]);
            if (isNaN(priceYes)) continue;

            // Update history
            const hist = this.priceHistory.get(market.id) || [];
            hist.push({ ts: now, price: priceYes });
            // Prune old entries
            while (hist.length > 0 && now - hist[0].ts > this.WINDOW_MS) {
              hist.shift();
            }
            // Keep history bounded for memory
            if (hist.length > 200) hist.splice(0, hist.length - 200);
            this.priceHistory.set(market.id, hist);

            // Need at least two points and oldest older than WINDOW_MS to evaluate
            if (hist.length < 2) continue;
            const oldest = hist[0];
            const latest = hist[hist.length - 1];

            const elapsed = latest.ts - oldest.ts;
            if (elapsed < this.WINDOW_MS * 0.9) continue; // ensure ~15min window

            const percentChange = (latest.price - oldest.price) / (oldest.price || 1);
            const absChange = Math.abs(percentChange);

            const volume24hr = Number(market.volume24hr) || 0;
            const minVolume = Number(context.settings?.minLiquidity) || 1000;

            if (absChange >= this.MIN_PERCENT_CHANGE && volume24hr >= Math.min(1000, minVolume / 10)) {
              const outcome = percentChange > 0 ? "YES" : "NO";

              // Size heuristics: proportionate to strength but capped by maxPositionSize
              const baseSize = Math.max(5, Math.round(absChange * 100));
              const maxSize = Number(context.settings?.maxPositionSize) || 10;
              const size = Math.min(maxSize, baseSize);

              const confidence = Math.min(1, absChange / 0.1); // 10% move => confidence 1
              const signalStrength = Math.round(absChange * 1000);

              opportunities.push({
                marketId: market.id,
                question: market.question,
                strategy: this.id,
                outcome: outcome as "YES" | "NO",
                price: outcome === "YES" ? latest.price : 1 - latest.price,
                size: size,
                confidence: confidence,
                signalStrength: signalStrength,
                timestamp: Date.now(),
                reason: `15min ${percentChange > 0 ? "UP" : "DOWN"} ${(percentChange * 100).toFixed(2)}%`,
                metadata: {
                  oldestPrice: oldest.price,
                  latestPrice: latest.price,
                  percentChange,
                  elapsedMs: elapsed,
                  volume24hr,
                },
              });
            }
          } catch (e) {
            console.error(`UpDown15Strategy error processing market ${market?.id}:`, e);
          }
        }
      }
    } catch (e) {
      console.error("UpDown15Strategy analyze error:", e);
    }

    return opportunities;
  }
}
