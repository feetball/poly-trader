import requests
import os
from datetime import datetime

# Configuration
TARGET_USER = os.getenv("POLYMARKET_TARGET_USER", "0x790A4485e5198763C0a34272698ed0cd9506949B") # Example whale
SUBGRAPH_URL = "https://api.thegraph.com/subgraphs/name/tokenunion/polymarket-matic"

# Timestamp threshold to detect milliseconds (timestamps after year 2286 in seconds)
MILLISECOND_THRESHOLD = 10000000000

def fetch_user_trades(user_address):
    query = """
    {
      transactions(
        where: { user: "%s" }
        orderBy: timestamp
        orderDirection: desc
        first: 100
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
    """ % user_address.lower()

    response = requests.post(SUBGRAPH_URL, json={'query': query})
    if response.status_code == 200:
        return response.json().get('data', {}).get('transactions', [])
    else:
        print(f"Error fetching data: {response.status_code}")
        return []

def analyze_trades(trades):
    print(f"Analyzing {len(trades)} trades for {TARGET_USER}...")
    
    total_volume = 0
    wins = 0
    losses = 0
    
    for trade in trades:
        price = float(trade['price'])
        amount = float(trade['amount'])
        volume = price * amount
        total_volume += volume
        
        # Simple heuristic: If they bought low and it's a recent trade, we don't know outcome yet
        # But we can see their average entry price
        
        # Handle timestamp conversion with error handling
        try:
            timestamp = int(trade['timestamp'])
            # Check if timestamp is in milliseconds (convert to seconds if so)
            if timestamp > MILLISECOND_THRESHOLD:
                timestamp = timestamp // 1000
            trade_time = datetime.fromtimestamp(timestamp)
        except (ValueError, TypeError, OSError):
            # If conversion fails, use a placeholder
            trade_time = "Invalid timestamp"
        
        print(f"[{trade_time}] {trade['type']} {amount:.2f} shares @ {price:.2f} - {trade['market']['question'][:50]}...")

    print(f"\nTotal Volume Traded: ${total_volume:.2f}")

if __name__ == "__main__":
    print("Polymarket Strategy Research Tool")
    print("---------------------------------")
    trades = fetch_user_trades(TARGET_USER)
    analyze_trades(trades)
