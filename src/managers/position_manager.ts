import { PolymarketClient } from "../clients/polymarket";

export interface Position {
  marketId: string;
  title: string;
  outcome: "YES" | "NO";
  shares: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  status: "OPEN" | "CLOSED";
}

export class PositionManager {
  private positions: Map<string, Position> = new Map();
  private client: PolymarketClient;

  constructor(client: PolymarketClient) {
    this.client = client;
  }

  async syncPositions() {
    // In a real implementation, this would fetch from the chain or CLOB API
    // For paper trading, we keep it in memory (already handled by the bot/client state usually, but we centralize it here)
    
    // If we are in real trading mode:
    // const balances = await this.client.getBalances();
    // this.updateFromBalances(balances);
  }

  addPosition(marketId: string, title: string, outcome: "YES" | "NO", shares: number, price: number) {
    const key = `${marketId}-${outcome}`;
    const existing = this.positions.get(key);

    if (existing) {
      // Update average price
      const totalCost = (existing.shares * existing.avgPrice) + (shares * price);
      const totalShares = existing.shares + shares;
      existing.avgPrice = totalCost / totalShares;
      existing.shares = totalShares;
    } else {
      this.positions.set(key, {
        marketId,
        title,
        outcome,
        shares,
        avgPrice: price,
        currentPrice: price,
        pnl: 0,
        status: "OPEN"
      });
    }
  }

  updatePrices(marketPrices: Map<string, number>) {
    for (const [key, position] of this.positions) {
      if (position.status === "CLOSED") continue;
      
      // Assuming marketPrices key is marketId
      // In reality, we need price per outcome. 
      // Simplified: marketPrices gives us the probability of YES.
      
      const currentProb = marketPrices.get(position.marketId);
      if (currentProb !== undefined) {
        const price = position.outcome === "YES" ? currentProb : (1 - currentProb);
        position.currentPrice = price;
        position.pnl = (position.currentPrice - position.avgPrice) * position.shares;
      }
    }
  }

  getPositions(): Position[] {
    return Array.from(this.positions.values()).filter(p => p.shares > 0);
  }

  // Mock redemption for paper trading
  redeem(marketId: string, winningOutcome: "YES" | "NO") {
    for (const [key, position] of this.positions) {
      if (position.marketId === marketId) {
        if (position.outcome === winningOutcome) {
          // Winner: Payout $1.00 per share
          const payout = position.shares * 1.0;
          position.pnl = payout - (position.shares * position.avgPrice);
          position.currentPrice = 1.0;
        } else {
          // Loser: Payout $0.00
          position.pnl = -(position.shares * position.avgPrice);
          position.currentPrice = 0.0;
        }
        position.status = "CLOSED";
        position.shares = 0;
      }
    }
  }
}
