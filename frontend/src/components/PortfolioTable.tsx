"use client";

import { useState, useEffect } from "react";
import { GlassCard } from "./ui/GlassCard";
import { Briefcase, TrendingUp, TrendingDown } from "lucide-react";
import { API_BASE } from "../lib/api";

export default function PortfolioTable() {
  const [positions, setPositions] = useState<any[]>([]);
  const [summary, setSummary] = useState<any | null>(null);

  useEffect(() => {
    const fetchPortfolio = () => {
      fetch(`${API_BASE}/api/portfolio`)
        .then((res) => res.json())
        .then((data) => {
          // Backwards-compatible: support both old array response and new { positions, summary }.
          if (Array.isArray(data)) {
            setPositions(data);
            setSummary(null);
            return;
          }

          setPositions(Array.isArray(data?.positions) ? data.positions : []);
          setSummary(data?.summary ?? null);
        })
        .catch(() => {
          setPositions([]);
          setSummary(null);
        });
    };

    fetchPortfolio();
    let interval: NodeJS.Timeout | null = setInterval(fetchPortfolio, 5000);

    // SSE: subscribe to live positions updates if supported
    let es: EventSource | null = null;
    try {
      if (typeof window !== "undefined" && typeof window.EventSource !== "undefined") {
        es = new window.EventSource(`${API_BASE}/api/positions/stream`);
        es.onopen = () => {
          // SSE connection established, clear polling interval to avoid redundant API calls
          if (interval !== null) {
            clearInterval(interval);
            interval = null;
          }
        };
        es.onmessage = (ev: MessageEvent) => {
          try {
            const data = JSON.parse(ev.data);
            setPositions(Array.isArray(data?.positions) ? data.positions : []);
            setSummary(data?.summary ?? null);
          } catch (e) {
            // ignore malformed SSE payloads but log for debugging
            console.debug("Ignored malformed SSE payload in PortfolioTable:", e);
          }
        };
        es.onerror = () => {
          // best-effort: close and rely on periodic fetch fallback
          try {
            es?.close();
          } catch (e) {
            console.debug("Error while closing EventSource in PortfolioTable.onerror handler:", e);
          }
          es = null;
          // Restart polling if SSE fails
          if (interval === null) {
            interval = setInterval(fetchPortfolio, 5000);
          }
        };
      }
    } catch (e) {
      // ignore if EventSource not available, but log for debugging
      console.debug("EventSource not available in this environment for PortfolioTable:", e);
    }

    return () => {
      if (interval !== null) {
        clearInterval(interval);
      }
      try {
        es?.close();
      } catch (e) {
        console.debug("Error while closing EventSource in PortfolioTable cleanup:", e);
      }
    };
  }, []);

  return (
    <GlassCard className="col-span-1 md:col-span-2" hoverEffect={false}>
      <div className="flex items-center gap-2 mb-6">
        <Briefcase className="w-5 h-5 text-purple-400" />
        <h2 className="text-lg font-semibold text-white/90">Active Positions</h2>
      </div>

      {summary && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/50 uppercase tracking-wider">Total P/L</span>
            <div
              className={`flex items-center gap-1 font-bold ${Number(summary.totalUnrealizedPnL) >= 0 ? "text-emerald-400" : "text-rose-400"}`}
            >
              {Number(summary.totalUnrealizedPnL) >= 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              <span>
                {Number(summary.totalUnrealizedPnL) >= 0 ? "+" : ""}
                {Number(summary.totalUnrealizedPnL).toFixed(2)}
              </span>
            </div>
            <span
              className={
                `px-2 py-1 rounded-md text-[10px] font-extrabold tracking-widest border ` +
                (Number(summary.totalUnrealizedPnL) >= 0
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                  : "bg-rose-500/10 border-rose-500/20 text-rose-300")
              }
            >
              {Number(summary.totalUnrealizedPnL) >= 0 ? "WIN" : "LOSS"}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-white/50">
            <div>
              Winners: <span className="text-emerald-300 font-bold">{Number(summary.openWinners) || 0}</span>
            </div>
            <div>
              Losers: <span className="text-rose-300 font-bold">{Number(summary.openLosers) || 0}</span>
            </div>
          </div>
        </div>
      )}
      
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-white/40 text-xs uppercase tracking-wider border-b border-white/5">
              <th className="px-4 py-3 font-medium">Market</th>
              <th className="px-4 py-3 font-medium">Side</th>
              <th className="px-4 py-3 font-medium">Shares</th>
              <th className="px-4 py-3 font-medium">Avg Price</th>
              <th className="px-4 py-3 font-medium">Current</th>
              <th className="px-4 py-3 font-medium text-right">PnL</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {positions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-white/30">
                  No active positions found
                </td>
              </tr>
            ) : (
              positions.map((pos, i) => (
                <tr key={i} className="group hover:bg-white/5 transition-colors">
                  <td className="px-4 py-4 font-medium text-white/90 truncate max-w-xs">
                    {pos.title}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`
                      px-2.5 py-1 rounded-lg text-xs font-bold border
                      ${pos.outcome === 'YES' 
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}
                    `}>
                      {pos.outcome}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-white/70">{pos.shares}</td>
                  <td className="px-4 py-4 text-white/70">${pos.avgPrice.toFixed(2)}</td>
                  <td className="px-4 py-4 text-white/70">${pos.currentPrice.toFixed(2)}</td>
                  <td className="px-4 py-4 text-right">
                    <div className={`flex items-center justify-end gap-1 font-bold ${pos.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {pos.pnl >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {pos.pnl >= 0 ? '+' : ''}{pos.pnl.toFixed(2)}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
