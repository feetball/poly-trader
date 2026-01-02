import requests
import time
import os
from datetime import datetime

# Configuration
TARGET_USER = os.getenv("POLYMARKET_TARGET_USER", "0x790A4485e5198763C0a34272698ed0cd9506949B") # Example whale
SUBGRAPH_URL = "https://api.thegraph.com/subgraphs/name/tokenunion/polymarket-matic"

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

def convert_timestamp(timestamp_value):
    """
    Convert a timestamp to datetime, handling various formats.
    
    Args:
        timestamp_value: The timestamp value (can be string, int, or float)
        
    Returns:
        datetime object or None if conversion fails
    
    Notes:
        - Handles both second and millisecond precision timestamps
        - Assumes timestamps > 1e12 (Sep 2001 in milliseconds) are in milliseconds
        - Preserves fractional seconds when provided
    """
    try:
        # Convert to float to preserve fractional seconds
        timestamp = float(timestamp_value)
        
        # Check if timestamp is in milliseconds
        # Use 1e12 as threshold (corresponds to Sep 9, 2001 01:46:40 UTC if milliseconds, ~year 31688 if seconds)
        # All realistic timestamps after Sep 2001 in milliseconds will be > 1e12
        if timestamp > 1e12:
            timestamp = timestamp / 1000.0
        
        return datetime.fromtimestamp(timestamp)
    except (ValueError, TypeError, OSError) as e:
        print(f"Warning: Could not convert timestamp '{timestamp_value}': {e}")
        return None

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
        
        timestamp_dt = convert_timestamp(trade['timestamp'])
        timestamp_str = timestamp_dt.strftime('%Y-%m-%d %H:%M:%S') if timestamp_dt else 'Unknown'
        print(f"[{timestamp_str}] {trade['type']} {amount:.2f} shares @ {price:.2f} - {trade['market']['question'][:50]}...")

    print(f"\nTotal Volume Traded: ${total_volume:.2f}")

if __name__ == "__main__":
    print("Polymarket Strategy Research Tool")
    print("---------------------------------")
    trades = fetch_user_trades(TARGET_USER)
    analyze_trades(trades)
