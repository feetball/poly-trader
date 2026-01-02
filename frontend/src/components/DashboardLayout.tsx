"use client";

import { useState, useEffect } from "react";
import { GlassCard } from "./ui/GlassCard";
import { LiquidButton } from "./ui/LiquidButton";
import { Activity, Power, RefreshCw, Terminal } from "lucide-react";
import { API_BASE } from "../lib/api";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [status, setStatus] = useState<any>({ status: "unknown" });

  useEffect(() => {
    fetch(`${API_BASE}/api/status`)
      .then((res) => res.json())
      .then((data) => setStatus(data))
      .catch(() => setStatus({ status: "offline" }));
  }, []);

  const toggleBot = async () => {
    const endpoint = status.status === "running" ? "stop" : "start";
    await fetch(`${API_BASE}/api/bot/${endpoint}`, { method: "POST" });
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-blue-500/30">
      {/* Background Gradients */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 container mx-auto px-6 py-8">
        {/* Header */}
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500 blur-lg opacity-50" />
              <div className="relative bg-black/40 p-3 rounded-xl border border-white/10 backdrop-blur-md">
                <Activity className="w-6 h-6 text-blue-400" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                PolyTrader AI
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={`w-2 h-2 rounded-full ${status.status === 'running' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-rose-500'}`} />
                <span className="text-xs font-medium text-white/40 uppercase tracking-widest">
                  System {status.status === 'running' ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <GlassCard className="!p-2 !rounded-xl flex items-center gap-3 px-4">
              <Terminal className="w-4 h-4 text-white/40" />
              <span className="text-xs font-mono text-white/60">v2.4.0-beta</span>
            </GlassCard>
            
            <LiquidButton 
              onClick={toggleBot}
              variant={status.status === 'running' ? 'danger' : 'success'}
              className="!py-2 !px-4 text-sm"
            >
              <div className="flex items-center gap-2">
                <Power className="w-4 h-4" />
                {status.status === 'running' ? 'Stop Engine' : 'Initialize'}
              </div>
            </LiquidButton>
          </div>
        </header>

        {/* Main Content */}
        <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {children}
        </main>
      </div>
    </div>
  );
}
