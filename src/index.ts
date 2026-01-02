import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PolymarketClient } from "./clients/polymarket";
import { Bot } from "./bot";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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

// API Routes
app.get("/", (req, res) => {
  res.send("PolyTrader Bot API is running. Check /api/status for details.");
});

app.get("/api/status", (req, res) => {
  res.json({ status: "running", address: client.getAddress() });
});

app.post("/api/bot/start", (req, res) => {
  bot.start();
  res.json({ message: "Bot started" });
});

app.post("/api/bot/stop", (req, res) => {
  bot.stop();
  res.json({ message: "Bot stopped" });
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
