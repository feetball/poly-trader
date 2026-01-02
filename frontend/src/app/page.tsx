"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { GlassCard } from "@/components/ui/GlassCard";
import { LiquidButton } from "@/components/ui/LiquidButton";
import SettingsPanel from "@/components/SettingsPanel";
import PortfolioTable from "@/components/PortfolioTable";
import MarketScanner from "@/components/MarketScanner";
import { Play, Square, Wallet, TrendingUp, AlertTriangle } from "lucide-react";

export default function Home() {
  const [status, setStatus] = useState<string>("loading");
  const [address, setAddress] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([]);

  const API_URL = "http://localhost:3030/api";

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/status`);
      const data = await res.json();
      setStatus(data.status);
      setAddress(data.address);
    } catch (error) {
      setStatus("offline");
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const controlBot = async (action: "start" | "stop") => {
    try {
      await fetch(`${API_URL}/bot/${action}`, { method: "POST" });
      addLog(`Sent ${action} command`);
      fetchStatus();
    } catch (error) {
      addLog(`Failed to send ${action} command`);
    }
  };

  const addLog = (msg: string) => {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  };

  return (
    <DashboardLayout>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Controls & Stats */}
        <div className="lg:col-span-4 space-y-6">
          <GlassCard className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white/90">Bot Control</h2>
              <div className={`px-3 py-1 rounded-full text-xs font-bold border ${
                status === 'running' 
                  ? 'bg-green-500/20 border-green-500/30 text-green-400' 
                  : 'bg-red-500/20 border-red-500/30 text-red-400'
              }`}>
                {status.toUpperCase()}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <LiquidButton 
                onClick={() => controlBot("start")}
                disabled={status === 'running'}
                className={status === 'running' ? 'opacity-50 cursor-not-allowed' : ''}
              >
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4 fill-current" />
                  START
                </div>
              </LiquidButton>
              
              <LiquidButton 
                variant="danger"
                onClick={() => controlBot("stop")}
                disabled={status !== 'running'}
                className={status !== 'running' ? 'opacity-50 cursor-not-allowed' : ''}
              >
                <div className="flex items-center gap-2">
                  <Square className="w-4 h-4 fill-current" />
                  STOP
                </div>
              </LiquidButton>
            </div>

            <div className="pt-4 border-t border-white/10">
              <div className="flex items-center justify-between text-sm text-white/60 mb-2">
                <span className="flex items-center gap-2">
                  <Wallet className="w-4 h-4" />
                  Wallet Balance
                </span>
                <span className="text-white font-mono">1,240.50 USDC</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full w-[65%] bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" />
              </div>
            </div>
          </GlassCard>

          <SettingsPanel />
        </div>

        {/* Middle Column: Scanner */}
        <div className="lg:col-span-5 space-y-6">
          <GlassCard className="h-[600px] flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white/90 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-400" />
                Market Scanner
              </h2>
              <div className="flex gap-2">
                {['Hot', 'New', 'Vol'].map(filter => (
                  <button key={filter} className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/70 transition-colors">
                    {filter}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 -mx-6 px-6 overflow-y-auto custom-scrollbar">
              <MarketScanner />
            </div>
          </GlassCard>
        </div>

        {/* Right Column: Logs & Alerts */}
        <div className="lg:col-span-3 space-y-6">
          <GlassCard className="h-[300px] flex flex-col">
            <h2 className="text-lg font-semibold text-white/90 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              System Logs
            </h2>
            <div className="flex-1 overflow-y-auto font-mono text-xs space-y-3 pr-2 custom-scrollbar">
              {logs.length === 0 && <span className="text-white/30 italic">System ready...</span>}
              {logs.map((log, i) => (
                <div key={i} className="flex gap-2 text-white/70 border-l-2 border-blue-500/50 pl-3 py-1">
                  <span className="text-blue-400">{log.split(']')[0]}]</span>
                  <span>{log.split(']')[1]}</span>
                </div>
              ))}
            </div>
          </GlassCard>
          
          {/* Placeholder for AI Insights */}
          <GlassCard className="h-[275px] bg-gradient-to-br from-purple-900/20 to-blue-900/20 border-purple-500/20">
            <h2 className="text-lg font-semibold text-white/90 mb-4">AI Insights</h2>
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="flex justify-between text-xs text-purple-300 mb-1">
                  <span>Arbitrage Opportunity</span>
                  <span>98% Conf.</span>
                </div>
                <p className="text-sm text-white/80">Detected 2.5% spread on "Fed Rate Cut" across Polymarket vs Kalshi.</p>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Bottom Row: Portfolio */}
        <div className="lg:col-span-12">
          <PortfolioTable />
        </div>

      </div>
    </DashboardLayout>
  );
}
