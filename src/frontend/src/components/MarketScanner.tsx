"use client";

import { useState, useEffect } from "react";
import { GlassCard } from "./ui/GlassCard";
import { Radar, TrendingUp, Activity } from "lucide-react";

export default function MarketScanner() {
  const [markets, setMarkets] = useState<any[]>([]);

  useEffect(() => {
    const fetchMarkets = () => {
      fetch("http://localhost:3030/api/markets")
        .then((res) => res.json())
        .then((data) => setMarkets(data));
    };

    fetchMarkets();
    const interval = setInterval(fetchMarkets, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <GlassCard className="h-[500px] flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Radar className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-semibold text-white/90">Market Scanner</h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-emerald-400/80 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Live Feed
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
        {markets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/30 gap-3">
            <Activity className="w-8 h-8 animate-pulse" />
            <span className="text-sm">Scanning Polymarket...</span>
          </div>
        ) : (
          markets.map((mkt) => (
            <div 
              key={mkt.id} 
              className="group p-4 bg-black/20 rounded-xl border border-white/5 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all duration-300 cursor-pointer"
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-medium text-sm text-white/90 line-clamp-2 group-hover:text-emerald-200 transition-colors">
                  {mkt.question}
                </h3>
                <span className="ml-3 flex-shrink-0 text-xs font-bold bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                  {(mkt.probability * 100).toFixed(0)}%
                </span>
              </div>
              
              <div className="flex justify-between items-center text-xs text-white/40">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-3 h-3" />
                  <span>Vol: ${(mkt.volume / 1000).toFixed(1)}k</span>
                </div>
                <div className="flex gap-1.5">
                  {mkt.tags.map((tag: string) => (
                    <span key={tag} className="bg-white/5 px-2 py-0.5 rounded-md border border-white/5 text-white/30 uppercase tracking-wider text-[10px]">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </GlassCard>
  );
}

