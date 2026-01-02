import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PolymarketClient } from "./clients/polymarket";
import { Bot } from "./bot";
import { UpdateManager } from "./managers/UpdateManager";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const packageJson = require("../package.json");
const updateManager = new UpdateManager(packageJson.version);

app.use(cors());
app.use(express.json());

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
  res.json({ currentVersion: packageJson.version, ...info });
});

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

type LogLevel = "log" | "info" | "warn" | "error";
type LogEntry = { ts: number; level: LogLevel; message: string };
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

// API Routes
app.get("/", (req, res) => {
  res.send("PolyTrader Bot API is running. Check /api/status for details.");
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

app.get("/api/portfolio", (req, res) => {
  res.json(bot.getPortfolio());
});

app.get("/api/markets", (req, res) => {
  res.json(bot.getScannedMarkets());
});



// Start Server
async function main() {
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

main();
