"use client";

import { GlassCard } from "./ui/GlassCard";
import { LiquidButton } from "./ui/LiquidButton";
import { Play, Square, Activity, Wallet, Settings, BarChart3 } from "lucide-react";
import { useState, useEffect } from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-blue-500/30">
      {/* Ambient Background Glow */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px] animate-pulse-slow delay-1000" />
      </div>

      {/* Glass Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-black/20 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
              PolyTrader
            </span>
          </div>

          <div className="flex items-center gap-1 bg-white/5 rounded-full p-1 border border-white/5">
            {["Dashboard", "Strategies", "Portfolio", "Settings"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab.toLowerCase())}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300 ${
                  activeTab === tab.toLowerCase()
                    ? "bg-white/10 text-white shadow-lg"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-mono">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              SYSTEM ONLINE
            </div>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-12 px-6 max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  );
}
