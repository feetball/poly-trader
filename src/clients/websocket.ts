import WebSocket from 'ws';
import { EventEmitter } from 'events';

export class MarketDataStream extends EventEmitter {
  private ws: WebSocket | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private subscriptions: Set<string> = new Set();
  private url = process.env.POLYMARKET_WS_URL || "wss://ws-subscriptions-clob.polymarket.com/ws/market";
  private channelType = process.env.POLYMARKET_WS_CHANNEL || "market";

  constructor() {
    super();
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.on('open', () => {
      console.log('Connected to Polymarket WS');
      this.startPing();
      this.resubscribe();
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        const raw = data.toString();
        const trimmed = raw.trim();
        // Server sometimes sends plain-text control messages.
        if (!trimmed) return;
        if (trimmed === "PONG" || trimmed === "NO NEW ASSETS") return;
        if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return;
        const message = JSON.parse(trimmed);
        this.handleMessage(message);
      } catch (e) {
        console.error('Error parsing WS message:', e);
      }
    });

    this.ws.on('close', () => {
      console.log('Polymarket WS closed. Reconnecting in 5s...');
      this.stopPing();
      setTimeout(() => this.connect(), 5000);
    });

    this.ws.on('error', (err) => {
      console.error('Polymarket WS error:', err);
    });
  }

  subscribe(assetIds: string[]) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      assetIds.forEach(id => this.subscriptions.add(id));
      return;
    }

    const newAssetIds = assetIds.filter((id) => !this.subscriptions.has(id));
    if (newAssetIds.length === 0) {
      return;
    }

    // Polymarket CLOB WSS expects `assets_ids` and channel `type` for market subscriptions.
    const msg = {
      assets_ids: newAssetIds,
      type: this.channelType,
      operation: "subscribe",
    };
    
    this.ws.send(JSON.stringify(msg));
    newAssetIds.forEach(id => this.subscriptions.add(id));
    console.log(`Subscribed to ${newAssetIds.length} assets`);
  }

  private resubscribe() {
    if (this.subscriptions.size > 0) {
      this.subscribe(Array.from(this.subscriptions));
    }
  }

  private handleMessage(msg: any) {
    // Polymarket WS format handling
    // Example: [{"event_type":"price_change","asset_id":"...","price":"..."}]
    
    if (Array.isArray(msg)) {
      msg.forEach(event => {
        if (event.event_type === "price_change" || event.event_type === "book") {
          this.emit('price_update', event);
        }
      });
    }
  }

  private startPing() {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        // Polymarket WSS quickstart uses plain "PING".
        this.ws.send("PING");
      }
    }, 10000);
  }

  private stopPing() {
    if (this.pingInterval) clearInterval(this.pingInterval);
  }
}
