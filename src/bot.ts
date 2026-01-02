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
  private positionManager: PositionManager;
  private marketStream: MarketDataStream;
  private userAnalysis: UserAnalysisService;
  
  private settings: BotSettings = {
    minLiquidity: 10000,
    maxPositionSize: 50, // USDC
    stopLossPercentage: 10,
    takeProfitPercentage: 20,
    enabledStrategies: ["arbitrage", "volume_spike"]
  };

  private strategies: Strategy[] = [];
  private scannedMarkets: ScannedMarket[] = [];
  // private positions: Position[] = []; // Removed in favor of PositionManager

  constructor(client: PolymarketClient) {
    this.client = client;
    this.positionManager = new PositionManager(client);
    this.marketStream = new MarketDataStream();
    this.userAnalysis = new UserAnalysisService();
    this.initializeStrategies();
    this.setupMarketStream();
  }

  private initializeStrategies() {
    this.strategies = [
      new ArbitrageStrategy(),
      new VolumeSpikeStrategy()
    ];
  }

  private setupMarketStream() {
    this.marketStream.on('price_update', (event) => {
      // Handle real-time price updates
      // console.log('Price update:', event);
      // Update position manager with new prices
      // this.positionManager.updatePrices(...)
    });
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log("Bot started...");
    this.marketStream.connect();
    this.runLoop();
  }

  async stop() {
    this.isRunning = false;
    console.log("Bot stopping...");
    // this.marketStream.disconnect();
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
    const positions = this.positionManager.getPositions();
    if (positions.length === 0) {
      // Return mock for UI demo if empty
      return [
        {
          marketId: "0x123...",
          title: "Will Bitcoin hit $100k in 2024?",
          outcome: "YES",
          shares: 100,
          avgPrice: 0.45,
          currentPrice: 0.52,
          pnl: 7.00,
          status: "OPEN"
        },
        {
          marketId: "0x456...",
          title: "Fed Interest Rate Cut in March?",
          outcome: "NO",
          shares: 50,
          avgPrice: 0.80,
          currentPrice: 0.75,
          pnl: -2.50,
          status: "OPEN"
        }
      ] as Position[];
    }
    return positions;
  }

  getScannedMarkets() {
    return this.scannedMarkets;
  }

  async analyzeUser(address: string) {
    return await this.userAnalysis.getUserTrades(address);
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
            const assetIdsToSubscribe: string[] = [];
            
            for (const event of events) {
                const eventMarkets = event.markets || [];
                for (const m of eventMarkets) {
                    let prob = 0.5;
                    try {
                        if (m.outcomePrices) {
                            const prices = JSON.parse(m.outcomePrices);
                            prob = parseFloat(prices[0]);
                        }
                    } catch (e) {}

                    markets.push({
                        id: m.id,
                        question: m.question,
                        volume: Number(m.volume) || 0,
                        probability: prob,
                        tags: [event.slug?.split('-')[0] || "General"]
                    });

                    // Collect asset IDs for WS subscription
                    if (m.clobTokenIds) {
                      try {
                        const tokens = JSON.parse(m.clobTokenIds);
                        assetIdsToSubscribe.push(...tokens);
                      } catch(e) {}
                    }
                }
            }
            this.scannedMarkets = markets.slice(0, 20);
            
            // Subscribe to top markets for real-time updates
            if (assetIdsToSubscribe.length > 0) {
              this.marketStream.subscribe(assetIdsToSubscribe.slice(0, 50));
            }
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
                    // For now, we simulate a trade for the first opportunity to populate the portfolio
                    if (this.positionManager.getPositions().length === 0 && Math.random() > 0.8) {
                       const opp = opportunities[0];
                       this.positionManager.addPosition(
                         opp.marketId,
                         opp.question || "Unknown Market",
                         opp.outcome as "YES" | "NO",
                         100,
                         opp.price
                       );
                       console.log("Executed simulated trade:", opp);
                    }
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
