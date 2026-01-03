import { PolymarketClient } from "./clients/polymarket";
import { EventEmitter } from "events";
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
  scanIntervalMs: number;
  updownHoldMs: number;
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
  public events: EventEmitter = new EventEmitter();
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
    scanIntervalMs: 5000,
    updownHoldMs: 15 * 60 * 1000,
    enabledStrategies: ["arbitrage", "volume_spike", "updown_15"]
  };

  private strategies: Strategy[] = [];
  private scannedMarkets: ScannedMarket[] = [];
  private assetToMarkets: Map<string, Set<string>> = new Map();
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
      if (typeof input.scanIntervalMs === "number" && Number.isFinite(input.scanIntervalMs)) {
        // Allow faster scanning only when explicitly enabled via ALLOW_FAST_SCAN.
        const minScan = process.env.ALLOW_FAST_SCAN === 'true' ? 200 : 1000;
        out.scanIntervalMs = Math.max(minScan, Math.min(5 * 60 * 1000, input.scanIntervalMs));
      }
      if (typeof input.updownHoldMs === "number" && Number.isFinite(input.updownHoldMs)) {
        out.updownHoldMs = Math.max(60_000, Math.min(60 * 60 * 1000, input.updownHoldMs));
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
    this.marketStream.on('price_update', (event: any) => {
      try {
        // event: { event_type: 'price_change', asset_id: '...', price: '0.123' }
        const assetId = event.asset_id || event.assetId || event.asset;
        const priceRaw = event.price || event.p || event.bid || event.ask;
        const price = Number(priceRaw);
        if (!assetId || !Number.isFinite(price)) return;

        const markets = this.assetToMarkets.get(assetId);
        if (!markets || markets.size === 0) return;

        const marketPrices: Map<string, number> = new Map();
        for (const mId of markets) {
          // Treat the incoming price as the YES probability for the market
          marketPrices.set(mId, price);
        }

        this.positionManager.updatePrices(marketPrices);
        // Notify listeners about live positions updates
        this.emitPositions();
      } catch (e) {
        console.error('Failed to process price_update event:', e);
      }
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
    this.emitPositions();
  }

  resetWalletAndPositions(amount: number = 10000) {
    this.walletBalance = Math.max(0, amount);
    this.positionManager.clearAllPositions();
    console.log(`Wallet reset to $${this.walletBalance.toFixed(2)} and positions cleared`);
    this.emitPositions();
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
        await this.runOnce();
      } catch (error) {
        console.error("Error in bot loop:", error);
      }

    const minScan = process.env.ALLOW_FAST_SCAN === 'true' ? 200 : 1000;
    const sleepMs = Math.max(minScan, Number(this.settings.scanIntervalMs) || 5000);
      await new Promise((resolve) => setTimeout(resolve, sleepMs));
    }
  }

  // Executes a single scan/act iteration. Extracted for testability.
  private async runOnce() {
    console.log("Scanning markets...");

    // Keep risk limits in sync with settings.
    this.positionManager.updateRiskLimits({
      maxPositionSize: Number(this.settings.maxPositionSize) || 50,
      // conservative default exposure cap: 10 positions worth of max size
      maxPortfolioExposure: Math.max(50, (Number(this.settings.maxPositionSize) || 50) * 10),
      stopLossPercentage: Number(this.settings.stopLossPercentage) || 10,
      takeProfitPercentage: Number(this.settings.takeProfitPercentage) || 20,
    });

    // 1. Fetch Real Market Data via Gamma API
    const events = await this.client.getGammaMarkets({
      limit: 10,
      active: true,
      closed: false,
      order: "volume24hr",
      ascending: false,
    });

    // Map Gamma data to our internal structure
    const marketYesPrices: Map<string, number> = new Map();
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

          if (Number.isFinite(prob)) {
            marketYesPrices.set(m.id, prob);
          }

          markets.push({
            id: m.id,
            question: m.question,
            volume: Number(m.volume) || 0,
            probability: prob,
            tags: [event.slug?.split("-")[0] || "General"],
          });

          // Collect asset IDs for WS subscription
          if (m.clobTokenIds) {
            try {
              const tokens = JSON.parse(m.clobTokenIds);
              assetIdsToSubscribe.push(...tokens);

              // Map asset token -> marketId for later price event handling
              if (Array.isArray(tokens)) {
                for (const t of tokens) {
                  const set = this.assetToMarkets.get(t) || new Set<string>();
                  set.add(m.id);
                  this.assetToMarkets.set(t, set);
                }
              }
            } catch (e) {}
          }
        }
      }
      this.scannedMarkets = markets.slice(0, 20);

      // Subscribe to top markets for real-time updates
      if (assetIdsToSubscribe.length > 0) {
        this.marketStream.subscribe(assetIdsToSubscribe.slice(0, 50));
      }
    }

    // Update PnL + enforce stop-loss/take-profit based on latest scanned prices.
    if (marketYesPrices.size > 0) {
      this.positionManager.updatePrices(marketYesPrices);
    }

    // Auto-close expired positions (e.g., 15-minute holds).
    this.positionManager.closeExpiredPositions(Date.now());

    // 2. Run Strategies
    const context: StrategyContext = {
      client: this.client,
      settings: this.settings,
    };

    for (const strategy of this.strategies) {
      if (this.settings.enabledStrategies.includes(strategy.id)) {
        const opportunities = await strategy.analyze(context);

        // Stamp strategy id for downstream consumers.
        for (const opp of opportunities) {
          if (!opp.strategy) opp.strategy = strategy.id;
        }

        if (opportunities.length > 0) {
          console.log(`Found ${opportunities.length} opportunities via ${strategy.name}`);

          // UpDown15: enter on signal, hold for ~15 minutes, then exit.
          if (strategy.id === "updown_15") {
            const now = Date.now();
            const holdMs = Math.max(
              60_000,
              Number(this.settings.updownHoldMs) || 15 * 60 * 1000
            );
            for (const opp of opportunities) {
              if (opp.outcome !== "YES" && opp.outcome !== "NO") continue;
              if (!opp.price || opp.price <= 0 || opp.price >= 1) continue;
              if (this.positionManager.hasOpenPosition(opp.marketId, opp.outcome)) continue;

              const desiredUsdc = Math.min(
                Number(this.settings.maxPositionSize) || 50,
                Number(opp.size) || Number(this.settings.maxPositionSize) || 50
              );
              const shares = Math.max(1, desiredUsdc / opp.price);

              const ok = this.positionManager.addPosition(
                opp.marketId,
                opp.question || "Unknown Market",
                opp.outcome,
                shares,
                opp.price
              );
              if (ok) {
                this.positionManager.setPositionMeta(opp.marketId, opp.outcome, {
                  openedAt: now,
                  closeAt: now + holdMs,
                  strategy: "updown_15",
                });
                console.log(
                  `Opened updown_15 position: ${opp.marketId} ${opp.outcome} @ ${opp.price.toFixed(3)} for ~$${desiredUsdc.toFixed(2)} (hold ${(holdMs / 60000).toFixed(0)}m)`
                );
              }
            }
          }
        }
      }
    }

    // Emit positions snapshot after a scan/strategy execution
    this.emitPositions();
  }

  private emitPositions() {
    try {
      this.events.emit('positions', this.getPortfolio());
    } catch (e) {
      // best-effort: ignore, but log for diagnostics
      console.debug("Non-critical error emitting positions event:", e);
  }
}
