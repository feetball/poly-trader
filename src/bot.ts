import { PolymarketClient } from "./clients/polymarket";
import { Strategy, StrategyContext } from "./strategies/base";
import { ArbitrageStrategy } from "./strategies/arbitrage";
import { VolumeSpikeStrategy } from "./strategies/volume";
import { PositionManager, Position } from "./managers/position_manager";
import { MarketDataStream } from "./clients/websocket";
import { UserAnalysisService } from "./services/user_analysis";

export interface BotSettings {
  minLiquidity: number;
  maxPositionSize: number;
  stopLossPercentage: number;
  takeProfitPercentage: number;
  enabledStrategies: string[];
}

export interface Position {
  marketId: string;
  title: string;
  outcome: "YES" | "NO";
  shares: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
}

export interface ScannedMarket {
  id: string;
  question: string;
  volume: number;
  probability: number;
  tags: string[];
}

export class Bot {
  private isRunning: boolean = false;
  private client: PolymarketClient;
  
  private settings: BotSettings = {
    minLiquidity: 10000,
    maxPositionSize: 50, // USDC
    stopLossPercentage: 10,
    takeProfitPercentage: 20,
    enabledStrategies: ["arbitrage", "volume_spike"]
  };

  private strategies: Strategy[] = [];
  private scannedMarkets: ScannedMarket[] = [];
  private positions: Position[] = [];

  constructor(client: PolymarketClient) {
    this.client = client;
    this.initializeStrategies();
  }

  private initializeStrategies() {
    this.strategies = [
      new ArbitrageStrategy(),
      new VolumeSpikeStrategy()
    ];
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log("Bot started...");
    this.runLoop();
  }

  async stop() {
    this.isRunning = false;
    console.log("Bot stopping...");
  }

  getSettings() {
    return this.settings;
  }

  updateSettings(newSettings: Partial<BotSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    console.log("Settings updated:", this.settings);
    return this.settings;
  }

  getPortfolio() {
    // In a real app, fetch from client/chain
    // For now, return mock positions if empty
    if (this.positions.length === 0) {
      return [
        {
          marketId: "0x123...",
          title: "Will Bitcoin hit $100k in 2024?",
          outcome: "YES",
          shares: 100,
          avgPrice: 0.45,
          currentPrice: 0.52,
          pnl: 7.00
        },
        {
          marketId: "0x456...",
          title: "Fed Interest Rate Cut in March?",
          outcome: "NO",
          shares: 50,
          avgPrice: 0.80,
          currentPrice: 0.75,
          pnl: -2.50
        }
      ] as Position[];
    }
    return this.positions;
  }

  getScannedMarkets() {
    return this.scannedMarkets;
  }

  private async runLoop() {
    while (this.isRunning) {
      try {
        console.log("Scanning markets...");
        
        // 1. Fetch Real Market Data via Gamma API
        const events = await this.client.getGammaMarkets({ 
          limit: 10, 
          active: true, 
          closed: false,
          order: "volume24hr",
          ascending: false
        });
        
        // Map Gamma data to our internal structure
        if (Array.isArray(events)) {
            const markets: ScannedMarket[] = [];
            
            for (const event of events) {
                // Gamma API returns events which contain markets
                const eventMarkets = event.markets || [];
                for (const m of eventMarkets) {
                    // Try to parse probability from outcomePrices
                    let prob = 0.5;
                    try {
                        if (m.outcomePrices) {
                            const prices = JSON.parse(m.outcomePrices);
                            prob = parseFloat(prices[0]); // Assume YES is index 0
                        }
                    } catch (e) {}

                    markets.push({
                        id: m.id,
                        question: m.question,
                        volume: Number(m.volume) || 0,
                        probability: prob,
                        tags: [event.slug?.split('-')[0] || "General"] // Simple tag extraction
                    });
                }
            }
            this.scannedMarkets = markets.slice(0, 20); // Keep top 20
        }

        // 2. Run Strategies
        const context: StrategyContext = {
            client: this.client,
            settings: this.settings
        };

        for (const strategy of this.strategies) {
            if (this.settings.enabledStrategies.includes(strategy.id)) {
                // console.log(`Running strategy: ${strategy.name}`);
                const opportunities = await strategy.analyze(context);
                
                if (opportunities.length > 0) {
                    console.log(`Found ${opportunities.length} opportunities via ${strategy.name}`);
                    // Execute trades here...
                    // For now, we could add them to a "Signals" list if we had one
                }
            }
        }

        // Sleep for 5 seconds
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error) {
        console.error("Error in bot loop:", error);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
}
