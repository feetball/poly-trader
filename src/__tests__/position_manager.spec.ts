import { describe, expect, it, vi } from "vitest";
import { PositionManager } from "../managers/position_manager";

function makePM() {
  // client is not used by the current PositionManager implementation
  return new PositionManager({} as any);
}

describe("PositionManager", () => {
  it("rejects positions that exceed maxPositionSize", () => {
    const pm = makePM();
    pm.updateRiskLimits({ maxPositionSize: 10 });

    const ok = pm.addPosition("m1", "Test", "YES", 100, 0.2); // cost = 20
    expect(ok).toBe(false);
    expect(pm.hasOpenPosition("m1", "YES")).toBe(false);
  });

  it("merges positions for same market/outcome", () => {
    const pm = makePM();
    pm.updateRiskLimits({ maxPositionSize: 1000, maxPortfolioExposure: 10_000 });

    expect(pm.addPosition("m1", "Test", "YES", 10, 0.4)).toBe(true);
    expect(pm.addPosition("m1", "Test", "YES", 10, 0.6)).toBe(true);

    expect(pm.hasOpenPosition("m1", "YES")).toBe(true);

    const positions = pm.getPositions();
    expect(positions).toHaveLength(1);
    expect(positions[0].shares).toBe(20);
    // avg should be (10*0.4 + 10*0.6)/20 = 0.5
    expect(positions[0].avgPrice).toBeCloseTo(0.5, 6);
  });

  it("closes on take-profit when price rises enough", () => {
    const pm = makePM();
    pm.updateRiskLimits({
      maxPositionSize: 1000,
      maxPortfolioExposure: 10_000,
      takeProfitPercentage: 10,
      stopLossPercentage: 50,
    });

    pm.addPosition("m1", "Test", "YES", 100, 0.4);

    const prices = new Map<string, number>();
    prices.set("m1", 0.6); // +50% on price

    pm.updatePrices(prices);

    expect(pm.hasOpenPosition("m1", "YES")).toBe(false);
    expect(pm.getDailyPnL()).toBeGreaterThan(0);
  });

  it("closes on stop-loss when price falls enough", () => {
    const pm = makePM();
    pm.updateRiskLimits({
      maxPositionSize: 1000,
      maxPortfolioExposure: 10_000,
      takeProfitPercentage: 100,
      stopLossPercentage: 10,
    });

    pm.addPosition("m1", "Test", "YES", 100, 0.5);

    const prices = new Map<string, number>();
    prices.set("m1", 0.4); // -20%

    pm.updatePrices(prices);

    expect(pm.hasOpenPosition("m1", "YES")).toBe(false);
    expect(pm.getDailyPnL()).toBeLessThan(0);
  });

  it("closes expired positions", () => {
    const pm = makePM();
    pm.updateRiskLimits({ maxPositionSize: 1000, maxPortfolioExposure: 10_000 });

    pm.addPosition("m1", "Test", "YES", 10, 0.5);
    pm.setPositionMeta("m1", "YES", { openedAt: 1, closeAt: 2, strategy: "t" });

    const closed = pm.closeExpiredPositions(10);
    expect(closed).toBe(1);
    expect(pm.hasOpenPosition("m1", "YES")).toBe(false);
  });

  it("resets daily PnL when day changes", () => {
    const pm = new PositionManager({} as any);

    (pm as any).dailyPnL = 123;
    (pm as any).lastDailyPnLResetDate = "2000-01-01";

    expect(pm.getDailyPnL()).toBe(0);
  });

  it("enforces daily loss limit in risk checks", () => {
    const pm = new PositionManager({} as any);
    pm.updateRiskLimits({ dailyLossLimit: 50 });
    (pm as any).lastDailyPnLResetDate = new Date().toISOString().slice(0, 10);
    (pm as any).dailyPnL = -100;

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ok = pm.checkRisk(1);
    expect(ok).toBe(false);
    warn.mockRestore();
  });

  it("redeems winner and loser outcomes", () => {
    const pm = new PositionManager({} as any);
    pm.updateRiskLimits({ maxPositionSize: 10_000, maxPortfolioExposure: 100_000 });

    pm.addPosition("m1", "Test", "YES", 10, 0.4);
    pm.addPosition("m1", "Test", "NO", 10, 0.6);

    pm.redeem("m1", "YES");

    const positions = (pm as any).positions as Map<string, any>;
    const yes = positions.get("m1-YES");
    const no = positions.get("m1-NO");

    expect(yes.status).toBe("CLOSED");
    expect(no.status).toBe("CLOSED");
    expect(yes.currentPrice).toBe(1.0);
    expect(no.currentPrice).toBe(0.0);
  });

  it("rejects orders that exceed portfolio exposure", () => {
    const pm = makePM();
    pm.updateRiskLimits({ maxPositionSize: 10_000, maxPortfolioExposure: 50 });

    // Existing exposure ~= 40
    expect(pm.addPosition("m1", "Test", "YES", 100, 0.4)).toBe(true);

    // New order would add 20 => 60 > 50
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(pm.addPosition("m2", "Test", "YES", 40, 0.5)).toBe(false);
    warn.mockRestore();
  });

  it("closePosition is a no-op when missing or already closed", () => {
    const pm = makePM();
    pm.closePosition("missing", "YES", 0.5);

    pm.updateRiskLimits({ maxPositionSize: 10_000, maxPortfolioExposure: 100_000 });
    pm.addPosition("m1", "Test", "YES", 10, 0.5);
    pm.closePosition("m1", "YES", 0.6);
    // already closed
    pm.closePosition("m1", "YES", 0.6);
  });

  it("closeExpiredPositions skips when no closeAt or not yet expired", () => {
    const pm = makePM();
    pm.updateRiskLimits({ maxPositionSize: 10_000, maxPortfolioExposure: 100_000 });
    pm.addPosition("m1", "Test", "YES", 10, 0.5);

    // no closeAt set
    expect(pm.closeExpiredPositions(Date.now())).toBe(0);

    pm.setPositionMeta("m1", "YES", { closeAt: Date.now() + 60_000 });
    expect(pm.closeExpiredPositions(Date.now())).toBe(0);
  });

  it("updatePrices leaves positions unchanged if no market price available", () => {
    const pm = makePM();
    pm.updateRiskLimits({ maxPositionSize: 10_000, maxPortfolioExposure: 100_000 });
    pm.addPosition("m1", "Test", "YES", 10, 0.5);
    const before = pm.getPositions()[0].currentPrice;
    pm.updatePrices(new Map());
    const after = pm.getPositions()[0].currentPrice;
    expect(after).toBe(before);
  });
});
