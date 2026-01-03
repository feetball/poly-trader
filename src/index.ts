import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PolymarketClient } from "./clients/polymarket";
import { Bot } from "./bot";
import { UpdateManager } from "./managers/UpdateManager";

dotenv.config();

type LogLevel = "log" | "info" | "warn" | "error";
type LogEntry = { ts: number; level: LogLevel; message: string };

// Extend Express types to include custom app.locals properties
declare global {
  namespace Express {
    interface Locals {
      restoreConsole: () => void;
    }
  }
}

export function createApp(opts: {
  bot: Bot;
  client: Pick<PolymarketClient, "getAddress" | "getApiCallsPerMinute">;
  updateManager: Pick<UpdateManager, "checkForUpdates" | "getLatestInfo">;
  packageVersion: string;
  paperTrading: boolean;
  captureLogs?: boolean;
}) {
  const {
    bot,
    client,
    updateManager,
    packageVersion,
    paperTrading,
    captureLogs = true,
  } = opts;

  const app = express();
  app.use(cors());
  app.use(express.json());

  const LOG_CAP = Number(process.env.LOG_BUFFER_SIZE || 500);
  const logBuffer: LogEntry[] = [];

  function pushLog(level: LogLevel, message: string) {
    logBuffer.push({ ts: Date.now(), level, message });
    if (logBuffer.length > LOG_CAP) logBuffer.splice(0, logBuffer.length - LOG_CAP);
  }

  // Capture stdout logs so the UI can show them
  const originalConsole = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };

  if (captureLogs) {
    console.log = (...args: any[]) => {
      pushLog("log", args.map(String).join(" "));
      originalConsole.log(...args);
    };
    console.info = (...args: any[]) => {
      pushLog("info", args.map(String).join(" "));
      originalConsole.info(...args);
    };
    console.warn = (...args: any[]) => {
      pushLog("warn", args.map(String).join(" "));
      originalConsole.warn(...args);
    };
    console.error = (...args: any[]) => {
      pushLog("error", args.map(String).join(" "));
      originalConsole.error(...args);
    };
  }

  // Allow tests/consumers to restore the original console methods.
  app.locals.restoreConsole = () => {
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  };

  // API Routes
  app.get("/", (req, res) => {
    res.send("PolyTrader Bot API is running. Check /api/status for details.");
  });

  // Manual check endpoint
  app.post("/api/check-update", async (req, res) => {
    try {
      const info = await updateManager.checkForUpdates();
      res.json(info);
    } catch (e) {
      res.status(500).json({ error: "Failed to check for updates" });
    }
  });

  // Serve cached version info (keeps GitHub calls to the background poll)
  app.get("/api/version", (req, res) => {
    const info = updateManager.getLatestInfo();
    res.json({ currentVersion: packageVersion, ...info });
  });

  app.get("/api/status", (req, res) => {
    const running = bot.isBotRunning();
    res.json({
      status: running ? "running" : "stopped",
      botRunning: running,
      address: client.getAddress(),
      paperTrading,
    });
  });

  app.post("/api/bot/start", (req, res) => {
    bot.start();
    res.json({ message: "Bot started", running: bot.isBotRunning() });
  });

  app.post("/api/bot/stop", (req, res) => {
    bot.stop();
    res.json({ message: "Bot stopped", running: bot.isBotRunning() });
  });

  app.get("/api/wallet", (req, res) => {
    res.json({ balance: bot.getWalletBalance() });
  });

  app.post("/api/wallet/set", (req, res) => {
    const { amount } = req.body;
    if (typeof amount !== "number" || amount < 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }
    bot.setWalletBalance(amount);
    res.json({ balance: bot.getWalletBalance() });
  });

  app.post("/api/positions/reset", (req, res) => {
    bot.resetPositions();
    res.json({ message: "Positions cleared" });
  });

  app.post("/api/reset-all", (req, res) => {
    const { amount } = req.body;
    const resetAmount = typeof amount === "number" ? amount : 10000;
    bot.resetWalletAndPositions(resetAmount);
    res.json({ message: "Wallet and positions reset", balance: bot.getWalletBalance() });
  });

  app.get("/api/logs", (req, res) => {
    const limit = Math.max(1, Math.min(1000, Number(req.query.limit || 200)));
    const since = Number(req.query.since || 0);
    const filtered = since ? logBuffer.filter((e) => e.ts >= since) : logBuffer;
    res.json({ entries: filtered.slice(-limit) });
  });

  app.post("/api/logs/clear", (req, res) => {
    logBuffer.length = 0;
    res.json({ ok: true });
  });

  app.get("/api/settings", (req, res) => {
    res.json(bot.getSettings());
  });

  app.post("/api/settings", (req, res) => {
    const updated = bot.updateSettings(req.body);
    res.json(updated);
  });

  app.get("/api/metrics", (req, res) => {
    try {
      const settings = bot.getSettings();
      res.json({
        apiCallsPerMinute: client.getApiCallsPerMinute(),
        scanIntervalMs: Number(settings.scanIntervalMs) || 5000,
        ts: Date.now(),
      });
    } catch (e) {
      res.status(500).json({ error: "Failed to compute metrics" });
    }
  });

  app.get("/api/portfolio", (req, res) => {
    res.json(bot.getPortfolio());
  });

  // Server-Sent Events: stream live positions (sends initial snapshot followed by updates)
  app.get("/api/positions/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    // Send initial snapshot
    res.flushHeaders?.();
    // Prevent unhandled socket errors when clients abort, but log them for debugging
    res.on("error", (err) => {
      console.error("SSE /api/positions/stream connection error:", err);
    });

    const send = (payload: any) => {
      try {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch (e) {
        // ignore write errors
      }
    };

    send(bot.getPortfolio());

    const handler = (payload: any) => send(payload);
    if (bot && bot.events && typeof bot.events.on === "function") {
      bot.events.on("positions", handler);
    }

    req.on("close", () => {
      try {
        if (bot && bot.events && typeof bot.events.off === "function") {
          bot.events.off("positions", handler);
        }
      } catch (e) {}
    });
  });

  app.get("/api/markets", (req, res) => {
    res.json(bot.getScannedMarkets());
  });

  return app;
}

// Start Server
/* v8 ignore start */
async function main() {
  const port = process.env.PORT || 3000;
  const packageJson = require("../package.json");
  const updateManager = new UpdateManager(packageJson.version);

  // Initialize Client and Bot
  let privateKey = process.env.PRIVATE_KEY;
  const paperTrading = process.env.PAPER_TRADING === "true";

  // Handle placeholder or empty key
  if (privateKey === "your_polygon_wallet_private_key" || privateKey === "") {
    privateKey = undefined;
  }

  if (!privateKey && !paperTrading) {
    console.error("PRIVATE_KEY is missing in .env and PAPER_TRADING is not enabled.");
    process.exit(1);
  }

  const client = new PolymarketClient(privateKey, paperTrading);
  const bot = new Bot(client);
  const app = createApp({
    bot,
    client,
    updateManager,
    packageVersion: packageJson.version,
    paperTrading,
    captureLogs: true,
  });

  try {
    await client.initialize();
    
    app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
    });
    
    // Start background update polling
    updateManager.startPolling(5 * 60 * 1000); // every 5 minutes

    // Auto-start bot if configured
    if (process.env.AUTO_START === "true") {
      bot.start();
    }
  } catch (error) {
    console.error("Failed to start application:", error);
    process.exit(1);
  }
}

// Only start the server when executed directly (not when imported by tests).
if (require.main === module) {
  main();
}
/* v8 ignore stop */
