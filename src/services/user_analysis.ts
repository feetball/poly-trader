import axios from "axios";

export interface UserTrade {
  id: string;
  marketId: string;
  question: string;
  outcomeIndex: number;
  price: number;
  size: number;
  timestamp: number;
  type: "BUY" | "SELL";
}

export class UserAnalysisService {
  private subgraphUrl = "https://api.thegraph.com/subgraphs/name/tokenunion/polymarket-matic";

  async getUserTrades(address: string): Promise<UserTrade[]> {
    const query = `
      {
        transactions(
          where: { user: "${address.toLowerCase()}" }
          orderBy: timestamp
          orderDirection: desc
          first: 50
        ) {
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
      const response = await axios.post(this.subgraphUrl, { query });
      const data = response.data?.data?.transactions || [];
      
      return data.map((t: any) => ({
        id: t.id,
        marketId: t.market.id,
        question: t.market.question,
        outcomeIndex: Number(t.outcomeIndex),
        price: Number(t.price),
        size: Number(t.amount),
        timestamp: Number(t.timestamp),
        type: t.type?.toUpperCase() || 'UNKNOWN'
      }));
    } catch (error) {
      console.error("Error fetching user trades:", error);
      return [];
    }
  }

  analyzePattern(trades: UserTrade[]) {
    if (trades.length === 0) return null;

    const totalVolume = trades.reduce((acc, t) => acc + (t.price * t.size), 0);
    const avgSize = totalVolume / trades.length;
    
    // Count frequency of trades by hour to find timing patterns
    const hourCounts = new Array(24).fill(0);
    trades.forEach(t => {
        const hour = new Date(t.timestamp * 1000).getHours();
        hourCounts[hour]++;
    });
    const peakHour = hourCounts.indexOf(Math.max(...hourCounts));

    return {
      totalTrades: trades.length,
      totalVolume,
      avgSize,
      peakTradingHour: peakHour,
      lastActive: trades[0].timestamp,
      riskScore: avgSize > 1000 ? "HIGH" : "LOW"
    };
  }
}
