import { PolymarketClient } from "./clients/polymarket";
import { Strategy, StrategyContext } from "./strategies/base";
import { ArbitrageStrategy } from "./strategies/arbitrage";
import { VolumeSpikeStrategy } from "./strategies/volume";
import { UpDown15Strategy } from "./strategies/updown15";
import { PositionManager, Position } from "./managers/position_manager";
import { MarketDataStream } from "./clients/websocket";
import { UserAnalysisService } from "./services/user_analysis";
import fs from "node:fs";
import path from "node:path";

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
  private walletBalance: number = 10000; // Default $10k
  private readonly settingsPath: string;
  
  private settings: BotSettings = {
    minLiquidity: 10000,
    maxPositionSize: 50, // USDC
    stopLossPercentage: 10,
    takeProfitPercentage: 20,
    enabledStrategies: ["arbitrage", "volume_spike", "updown_15"]
  };

  private strategies: Strategy[] = [];
  private scannedMarkets: ScannedMarket[] = [];
  // private positions: Position[] = []; // Removed in favor of PositionManager

  constructor(client: PolymarketClient) {
    this.client = client;
    this.positionManager = new PositionManager(client);
    this.marketStream = new MarketDataStream();
    this.userAnalysis = new UserAnalysisService();

    this.settingsPath =
      process.env.SETTINGS_PATH || path.join(process.cwd(), "data", "settings.json");
    this.loadSettingsFromDisk();

    this.initializeStrategies();
    this.setupMarketStream();
  }

  private loadSettingsFromDisk() {
    try {
      if (!fs.existsSync(this.settingsPath)) return;
      const raw = fs.readFileSync(this.settingsPath, "utf8");
      const parsed = JSON.parse(raw);
      this.settings = { ...this.settings, ...this.sanitizeSettings(parsed) };
      console.log(`Loaded settings from ${this.settingsPath}`);
    } catch (e) {
      console.warn("Failed to load settings from disk; using defaults:", e);
    }
  }

  private saveSettingsToDisk() {
    try {
      const dir = path.dirname(this.settingsPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2), "utf8");
    } catch (e) {
      console.warn("Failed to persist settings to disk:", e);
    }
  }

  private sanitizeSettings(input: any): Partial<BotSettings> {
    const out: Partial<BotSettings> = {};

    if (input && typeof input === "object") {
      if (typeof input.minLiquidity === "number" && Number.isFinite(input.minLiquidity)) {
        out.minLiquidity = Math.max(0, input.minLiquidity);
      }
      if (typeof input.maxPositionSize === "number" && Number.isFinite(input.maxPositionSize)) {
        out.maxPositionSize = Math.max(0, input.maxPositionSize);
      }
      if (
        typeof input.stopLossPercentage === "number" &&
        Number.isFinite(input.stopLossPercentage)
      ) {
        out.stopLossPercentage = Math.max(0, input.stopLossPercentage);
      }
      if (
        typeof input.takeProfitPercentage === "number" &&
        Number.isFinite(input.takeProfitPercentage)
      ) {
        out.takeProfitPercentage = Math.max(0, input.takeProfitPercentage);
      }
      if (Array.isArray(input.enabledStrategies)) {
        out.enabledStrategies = input.enabledStrategies
          .filter((s: any) => typeof s === "string")
          .map((s: string) => s.trim())
          .filter(Boolean);
      }
    }

    return out;
  }

  private initializeStrategies() {
    this.strategies = [
      new ArbitrageStrategy(),
      new VolumeSpikeStrategy(),
      new UpDown15Strategy()
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

  isBotRunning() {
    return this.isRunning;
  }

  getWalletBalance(): number {
    return this.walletBalance;
  }

  setWalletBalance(amount: number) {
    if (amount < 0) amount = 0;
    this.walletBalance = amount;
    console.log(`Wallet balance set to $${amount.toFixed(2)}`);
  }

  resetPositions() {
    this.positionManager.clearAllPositions();
    console.log("All positions cleared");
  }

  resetWalletAndPositions(amount: number = 10000) {
    this.walletBalance = Math.max(0, amount);
    this.positionManager.clearAllPositions();
    console.log(`Wallet reset to $${this.walletBalance.toFixed(2)} and positions cleared`);
  }

  getSettings() {
    return this.settings;
  }

  updateSettings(newSettings: Partial<BotSettings>) {
    const sanitized = this.sanitizeSettings(newSettings);
    this.settings = { ...this.settings, ...sanitized };
    this.saveSettingsToDisk();
    console.log("Settings updated:", this.settings);
    return this.settings;
  }

  getPortfolio() {
    const positions = this.positionManager.getPositions();
    if (positions.length === 0) {
      // Return mock for UI demo if empty
      const mock = [
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

      const totalUnrealizedPnL = mock.reduce((sum, p) => sum + (Number(p.pnl) || 0), 0);
      const openWinners = mock.filter((p) => (Number(p.pnl) || 0) > 0).length;
      const openLosers = mock.filter((p) => (Number(p.pnl) || 0) < 0).length;

      return {
        positions: mock,
        summary: {
          totalUnrealizedPnL,
          openWinners,
          openLosers,
          dailyRealizedPnL: this.positionManager.getDailyPnL(),
        },
      };
    }

    const totalUnrealizedPnL = positions.reduce((sum, p) => sum + (Number(p.pnl) || 0), 0);
    const openWinners = positions.filter((p) => (Number(p.pnl) || 0) > 0).length;
    const openLosers = positions.filter((p) => (Number(p.pnl) || 0) < 0).length;

    return {
      positions,
      summary: {
        totalUnrealizedPnL,
        openWinners,
        openLosers,
        dailyRealizedPnL: this.positionManager.getDailyPnL(),
      },
    };
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
