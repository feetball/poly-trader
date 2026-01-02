"use client";

import { useState, useEffect } from "react";
import { GlassCard } from "./ui/GlassCard";
import { Briefcase, TrendingUp, TrendingDown } from "lucide-react";

export default function PortfolioTable() {
  const [positions, setPositions] = useState<any[]>([]);

  useEffect(() => {
    const fetchPortfolio = () => {
      fetch("http://localhost:3030/api/portfolio")
        .then((res) => res.json())
        .then((data) => setPositions(data));
    };

    fetchPortfolio();
    const interval = setInterval(fetchPortfolio, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <GlassCard className="col-span-1 md:col-span-2">
      <div className="flex items-center gap-2 mb-6">
        <Briefcase className="w-5 h-5 text-purple-400" />
        <h2 className="text-lg font-semibold text-white/90">Active Positions</h2>
      </div>
      
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

