import axios from "axios";

export interface UserTrade {
  id: string;
  marketId: string;
  outcome: string;
  price: number;
  size: number;
  timestamp: number;
  type: "BUY" | "SELL";
}

export class UserAnalysisService {
  private subgraphUrl = "https://api.thegraph.com/subgraphs/name/tokenunion/polymarket-matic"; // Example URL

  async getUserTrades(address: string): Promise<UserTrade[]> {
    // GraphQL query to fetch trades
    const query = `
      {
        transactions(where: { user: "${address.toLowerCase()}" }, orderBy: timestamp, orderDirection: desc, first: 100) {
          id
          market {
            id
            question
          }
          outcomeIndex
          price
          amount
          timestamp
          type
        }
      }
    `;

    try {
      // Mock response for now as we don't have the exact subgraph schema handy
      // const response = await axios.post(this.subgraphUrl, { query });
      // return this.parseTrades(response.data);
      
      console.log(`Fetching trades for ${address}...`);
      return [
        {
          id: "0x1",
          marketId: "0x123",
          outcome: "YES",
          price: 0.55,
          size: 1000,
          timestamp: Date.now() - 10000,
          type: "BUY"
        }
      ];
    } catch (error) {
      console.error("Error fetching user trades:", error);
      return [];
    }
  }

  analyzePattern(trades: UserTrade[]) {
    // Simple pattern recognition
    const winRate = 0.65; // Mock calculation
    const avgSize = trades.reduce((acc, t) => acc + t.size, 0) / trades.length;
    
    return {
      winRate,
      avgSize,
      favoriteCategory: "Politics", // Mock
      riskScore: "HIGH"
    };
  }
}
