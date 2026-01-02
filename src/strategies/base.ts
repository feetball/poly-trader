import { PolymarketClient } from "../clients/polymarket";

export interface StrategyContext {
  client: PolymarketClient;
  settings: any;
}

export interface MarketOpportunity {
  marketId: string;
  question?: string;
  strategy?: string; // Optional, added by the bot runner usually
  action?: "BUY" | "SELL";
  outcome: "YES" | "NO" | "BOTH";
  price: number;
  size?: number;
  confidence: number;
  signalStrength?: number;
  reason?: string;
  timestamp?: number;
  metadata?: any;
}

export abstract class Strategy {
  abstract id: string;
  abstract name: string;
  abstract description: string;

  abstract analyze(context: StrategyContext): Promise<MarketOpportunity[]>;
}
