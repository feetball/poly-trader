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

export interface RiskLimits {
  maxPositionSize: number; // Max USDC per position
  maxPortfolioExposure: number; // Max total USDC exposed
  stopLossPercentage: number; // Max loss % before auto-close
  dailyLossLimit: number; // Max daily loss
}

export class PositionManager {
  private positions: Map<string, Position> = new Map();
  private client: PolymarketClient;
  private riskLimits: RiskLimits = {
    maxPositionSize: 50,
    maxPortfolioExposure: 500,
    stopLossPercentage: 15,
    dailyLossLimit: 100
  };
  private dailyPnL: number = 0;
  private lastDailyPnLResetDate: string | null = null;

  constructor(client: PolymarketClient) {
    this.client = client;
    // Initialize the daily PnL reset date to today so we only reset when the day actually changes.
    this.lastDailyPnLResetDate = new Date().toISOString().slice(0, 10);
  }

  updateRiskLimits(limits: Partial<RiskLimits>) {
    this.riskLimits = { ...this.riskLimits, ...limits };
  }

  /**
   * Ensure that dailyPnL represents only today's PnL by resetting it
   * when a new calendar day starts.
   */
  private ensureDailyPnLReset(): void {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    if (this.lastDailyPnLResetDate !== today) {
      this.dailyPnL = 0;
      this.lastDailyPnLResetDate = today;
    }
  }

  checkRisk(sizeUSDC: number): boolean {
    // Ensure daily PnL is scoped to the current day before applying risk checks
    this.ensureDailyPnLReset();
    // 1. Check Position Size Limit
    if (sizeUSDC > this.riskLimits.maxPositionSize) {
      console.warn(`Risk Check Failed: Order size ${sizeUSDC} > Max ${this.riskLimits.maxPositionSize}`);
      return false;
    }

    // 2. Check Portfolio Exposure
    const currentExposure = Array.from(this.positions.values())
      .filter(p => p.status === "OPEN")
      .reduce((sum, p) => sum + (p.shares * p.avgPrice), 0);
    
    if (currentExposure + sizeUSDC > this.riskLimits.maxPortfolioExposure) {
      console.warn(`Risk Check Failed: Exposure ${currentExposure + sizeUSDC} > Max ${this.riskLimits.maxPortfolioExposure}`);
      return false;
    }

    // 3. Check Daily Loss Limit
    if (this.dailyPnL < -this.riskLimits.dailyLossLimit) {
      console.warn(`Risk Check Failed: Daily Loss ${this.dailyPnL} exceeds limit ${this.riskLimits.dailyLossLimit}`);
      return false;
    }

    return true;
  }

  async syncPositions() {
    // In a real implementation, this would fetch from the chain or CLOB API
    // For paper trading, we keep it in memory (already handled by the bot/client state usually, but we centralize it here)
    
    // If we are in real trading mode:
    // const balances = await this.client.getBalances();
    // this.updateFromBalances(balances);
  }

  addPosition(marketId: string, title: string, outcome: "YES" | "NO", shares: number, price: number) {
    const cost = shares * price;
    if (!this.checkRisk(cost)) return false;

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
    return true;
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

        // Check Stop Loss
        const lossPct = (position.pnl / (position.shares * position.avgPrice)) * -100;
        if (position.pnl < 0 && lossPct > this.riskLimits.stopLossPercentage) {
            console.log(`Stop Loss Triggered for ${position.title}: -${lossPct.toFixed(2)}%`);
            // In real bot, trigger sell order here
            this.closePosition(position.marketId, position.outcome, position.currentPrice);
        }
      }
    }
  }

  closePosition(marketId: string, outcome: "YES" | "NO", price: number) {
      const key = `${marketId}-${outcome}`;
      const position = this.positions.get(key);
      if (position && position.status === "OPEN") {
          const pnl = (price - position.avgPrice) * position.shares;
          this.dailyPnL += pnl;
          position.status = "CLOSED";
          position.shares = 0;
          position.pnl = pnl;
          console.log(`Position Closed: ${position.title} (${outcome}) PnL: $${pnl.toFixed(2)}`);
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
          const pnl = payout - (position.shares * position.avgPrice);
          this.dailyPnL += pnl;
          position.pnl = pnl;
          position.currentPrice = 1.0;
        } else {
          // Loser: Payout $0.00
          const pnl = -(position.shares * position.avgPrice);
          this.dailyPnL += pnl;
          position.pnl = pnl;
          position.currentPrice = 0.0;
        }
        position.status = "CLOSED";
        position.shares = 0;
      }
    }
  }
}
