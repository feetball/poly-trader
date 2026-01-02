import { PolymarketClient } from "./clients/polymarket";
import { Strategy, StrategyContext } from "./strategies/base";
import { ArbitrageStrategy } from "./strategies/arbitrage";
import { VolumeSpikeStrategy } from "./strategies/volume";

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
        // Note: In a real scenario, we would use pagination or specific queries
        const gammaMarkets = await this.client.getGammaMarkets({ limit: 10, active: true });
        
        // Map Gamma data to our internal structure
        if (Array.isArray(gammaMarkets)) {
            this.scannedMarkets = gammaMarkets.map((m: any) => ({
                id: m.id,
                question: m.title,
                volume: Number(m.volume) || 0,
                probability: 0.5, // Gamma API structure varies, simplified here
                tags: m.tags ? m.tags.map((t: any) => t.label) : []
            }));
        } else {
            // Fallback to mock if API fails or returns unexpected format
             this.scannedMarkets = [
                {
                    id: "mkt-1",
                    question: "Presidential Election Winner 2024",
                    volume: 5000000 + Math.floor(Math.random() * 100000),
                    probability: 0.45 + (Math.random() * 0.05),
                    tags: ["Politics", "US"]
                }
            ];
        }

        // 2. Run Strategies
        const context: StrategyContext = {
            client: this.client,
            settings: this.settings
        };

        for (const strategy of this.strategies) {
            if (this.settings.enabledStrategies.includes(strategy.id)) {
                console.log(`Running strategy: ${strategy.name}`);
                const opportunities = await strategy.analyze(context);
                
                if (opportunities.length > 0) {
                    console.log(`Found ${opportunities.length} opportunities via ${strategy.name}`);
                    // Execute trades here...
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
