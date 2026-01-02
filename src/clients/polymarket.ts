import { ClobClient, Side } from "@polymarket/clob-client";
import { ethers } from "ethers";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

export class PolymarketClient {
  private client: ClobClient | null = null;
  private signer: ethers.Wallet;
  private chainId: number = 137; // Polygon Mainnet
  private paperTrading: boolean = false;
  private paperBalance: number = 1000; // Fake USDC balance
  private gammaApiUrl = "https://gamma-api.polymarket.com"; // Gamma API Endpoint
  private apiCallTimestamps: number[] = [];

  constructor(privateKey?: string, paperTrading: boolean = false) {
    this.paperTrading = paperTrading;
    const provider = new ethers.providers.JsonRpcProvider(
      process.env.RPC_URL || "https://polygon-rpc.com"
    );

    if (privateKey) {
      this.signer = new ethers.Wallet(privateKey, provider);
    } else if (paperTrading) {
      // Generate random wallet for read-only access in paper mode
      console.log("Paper trading mode: Generating random wallet for API access...");
      this.signer = ethers.Wallet.createRandom().connect(provider);
    } else {
      throw new Error("Private key is required for real trading");
    }
  }

  async initialize() {
    try {
      this.client = new ClobClient(
        process.env.POLYMARKET_API_URL || "https://clob.polymarket.com",
        this.chainId,
        this.signer
      );
      console.log(`Polymarket CLOB Client initialized (Paper Trading: ${this.paperTrading})`);
    } catch (error) {
      console.error("Failed to initialize Polymarket client:", error);
      throw error;
    }
  }

  private recordApiCall() {
    const now = Date.now();
    this.apiCallTimestamps.push(now);
    // prune older than 60s
    const cutoff = now - 60_000;
    while (this.apiCallTimestamps.length > 0 && this.apiCallTimestamps[0] < cutoff) {
      this.apiCallTimestamps.shift();
    }
    // keep bounded even if time jumps
    if (this.apiCallTimestamps.length > 100_000) {
      this.apiCallTimestamps.splice(0, this.apiCallTimestamps.length - 100_000);
    }
  }

  private pruneApiCalls(now: number) {
    const cutoff = now - 60_000;
    while (this.apiCallTimestamps.length > 0 && this.apiCallTimestamps[0] < cutoff) {
      this.apiCallTimestamps.shift();
    }
  }

  getApiCallsPerMinute(): number {
    const now = Date.now();
    this.pruneApiCalls(now);
    return this.apiCallTimestamps.length;
  }

  // --- Gamma API (Market Data) ---
  async getGammaMarkets(params: any = {}) {
    try {
      this.recordApiCall();
      const response = await axios.get(`${this.gammaApiUrl}/events`, { params });
      return response.data;
    } catch (error) {
      console.error("Gamma API Error:", error);
      return [];
    }
  }

  // --- CLOB API (Trading) ---
  async getMarkets(nextCursor?: string) {
    if (!this.client) throw new Error("Client not initialized");
    this.recordApiCall();
    return await this.client.getMarkets(nextCursor);
  }

  async getOrderBook(tokenId: string) {
    if (!this.client) throw new Error("Client not initialized");
    this.recordApiCall();
    return await this.client.getOrderBook(tokenId);
  }

  async createOrder(tokenId: string, price: number, size: number, side: Side) {
    if (!this.client) throw new Error("Client not initialized");
    
    if (this.paperTrading) {
      console.log(`[PAPER TRADE] ${side} Order: ${size} shares of ${tokenId} @ $${price}`);
      // Simulate order execution
      return {
        orderID: "paper-" + Math.random().toString(36).substring(7),
        status: "filled",
        sizeMatched: size
      };
    }

    this.recordApiCall();
    return await this.client.createOrder({
      tokenID: tokenId,
      price: price,
      side: side,
      size: size,
      feeRateBps: 0,
    });
  }

  async getBalance() {
    if (this.paperTrading) {
      return this.paperBalance.toString();
    }
    // In a real app, you'd fetch USDC balance from the contract
    const balance = await this.signer.getBalance();
    return ethers.utils.formatEther(balance); // This is MATIC balance, not USDC
  }
  
  getAddress() {
    return this.signer.address;
  }
}
