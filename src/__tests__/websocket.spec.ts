import { describe, expect, it, vi } from "vitest";

vi.mock("ws", async () => {
  const { EventEmitter } = await import("node:events");

  class FakeWebSocket extends EventEmitter {
    static OPEN = 1;
    OPEN = 1;
    readyState = 1;
    url: string;
    send = vi.fn();

    constructor(url: string) {
      super();
      this.url = url;
      queueMicrotask(() => this.emit("open"));
    }
  }

  return { default: FakeWebSocket };
});

import { MarketDataStream } from "../clients/websocket";

describe("MarketDataStream", () => {
  it("ignores plaintext control messages", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const stream = new MarketDataStream();
    stream.connect();

    const ws = (stream as any).ws as any;

    ws.emit("message", Buffer.from("PONG"));
    ws.emit("message", Buffer.from("NO NEW ASSETS"));
    ws.emit("message", Buffer.from(""));

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("subscribes only new asset IDs", async () => {
    const stream = new MarketDataStream();
    stream.connect();

    const ws = (stream as any).ws as any;

    stream.subscribe(["a", "b"]);
    stream.subscribe(["a", "b"]);
    stream.subscribe(["b", "c"]);

    expect(ws.send).toHaveBeenCalledTimes(2);
  });

  it("queues subscriptions when not connected and resubscribes on open", async () => {
    const stream = new MarketDataStream();

    // queue before connect (ws is null)
    stream.subscribe(["a", "b"]);

    stream.connect();
    // open is emitted in a microtask by the mock
    await Promise.resolve();
    await Promise.resolve();

    const ws = (stream as any).ws as any;
    expect(ws.send).toHaveBeenCalledTimes(1);
  });

  it("does not send duplicate subscription payloads", async () => {
    const stream = new MarketDataStream();
    stream.connect();

    const ws = (stream as any).ws as any;

    stream.subscribe(["a"]);
    stream.subscribe(["a"]);
    expect(ws.send).toHaveBeenCalledTimes(1);
  });

  it("starts pinging and sends PING when open", async () => {
    vi.useFakeTimers();
    const stream = new MarketDataStream();
    stream.connect();

    // allow open handler to run and schedule interval
    await Promise.resolve();
    await Promise.resolve();

    const ws = (stream as any).ws as any;

    vi.advanceTimersByTime(10_000);
    expect(ws.send).toHaveBeenCalledWith("PING");

    vi.useRealTimers();
  });

  it("logs parse errors for invalid JSON and schedules reconnect on close", async () => {
    vi.useFakeTimers();
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const stream = new MarketDataStream();
    stream.connect();
    const ws = (stream as any).ws as any;

    ws.emit("message", Buffer.from("{not json"));
    expect(errSpy).toHaveBeenCalled();

    // avoid infinite reconnect by replacing connect before close triggers timeout
    (stream as any).connect = vi.fn();
    ws.emit("close");

    vi.advanceTimersByTime(5_000);
    expect((stream as any).connect).toHaveBeenCalledTimes(1);

    errSpy.mockRestore();
    vi.useRealTimers();
  });

  it("emits price_update for array messages", async () => {
    const stream = new MarketDataStream();
    stream.connect();

    const ws = (stream as any).ws as any;

    const seen: any[] = [];
    stream.on("price_update", (evt) => seen.push(evt));

    ws.emit(
      "message",
      Buffer.from(
        JSON.stringify([
          { event_type: "price_change", asset_id: "x", price: "0.5" },
          { event_type: "ignored", asset_id: "y" },
        ])
      )
    );

    expect(seen).toHaveLength(1);
    expect(seen[0].asset_id).toBe("x");
  });
});
