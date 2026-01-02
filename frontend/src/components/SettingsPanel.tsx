"use client";

import { useState, useEffect } from "react";
import { GlassCard } from "./ui/GlassCard";
import { LiquidButton } from "./ui/LiquidButton";
import { Settings, Save } from "lucide-react";

export default function SettingsPanel() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [versionInfo, setVersionInfo] = useState<any>(null);

  useEffect(() => {
    // In Docker, client-side fetch to localhost:3030 works if port is exposed
    fetch("http://localhost:3030/api/settings")
      .then((res) => res.json())
      .then((data) => {
        setSettings(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch settings", err);
        // Mock data for UI preview if fetch fails
        setSettings({
            maxPositionSize: 50,
            stopLossPercentage: 10,
            takeProfitPercentage: 20,
            enabledStrategies: ["arbitrage"]
        });
        setLoading(false);
      });

      fetch("http://localhost:3030/api/version")
        .then(res => res.json())
        .then(data => setVersionInfo(data))
        .catch(err => console.error("Failed to fetch version", err));
  }, []);

  const saveSettings = async () => {
    try {
        await fetch("http://localhost:3030/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
        });
    } catch (e) {
        console.error("Save failed", e);
    }
  };

  if (loading) return <GlassCard>Loading settings...</GlassCard>;

  return (
    <GlassCard>
      <div className="flex items-center gap-2 mb-6">
        <Settings className="w-5 h-5 text-blue-400" />
        <h2 className="text-lg font-semibold text-white/90">Configuration</h2>
      </div>
      
      <div className="space-y-5">
        <div>
          <label className="block text-xs font-medium text-white/60 mb-1.5 uppercase tracking-wider">Max Position (USDC)</label>
          <input
            type="number"
            value={settings.maxPositionSize}
            onChange={(e) => setSettings({ ...settings, maxPositionSize: Number(e.target.value) })}
            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500/50 transition-colors"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5 uppercase tracking-wider">Stop Loss (%)</label>
            <input
              type="number"
              value={settings.stopLossPercentage}
              onChange={(e) => setSettings({ ...settings, stopLossPercentage: Number(e.target.value) })}
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500/50 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5 uppercase tracking-wider">Take Profit (%)</label>
            <input
              type="number"
              value={settings.takeProfitPercentage}
              onChange={(e) => setSettings({ ...settings, takeProfitPercentage: Number(e.target.value) })}
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500/50 transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-wider">Active Strategies</label>
          <div className="flex flex-wrap gap-2">
            {["arbitrage", "volume_spike", "copy_trading", "market_making", "ai_signals"].map((strat) => (
              <label 
                key={strat} 
                className={`
                  cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-200
                  ${settings.enabledStrategies.includes(strat) 
                    ? 'bg-blue-500/20 border-blue-500/50 text-blue-200' 
                    : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}
                `}
              >
                <input
                  type="checkbox"
                  className="hidden"
                  checked={settings.enabledStrategies.includes(strat)}
                  onChange={(e) => {
                    const newStrats = e.target.checked
                      ? [...settings.enabledStrategies, strat]
                      : settings.enabledStrategies.filter((s: string) => s !== strat);
                    setSettings({ ...settings, enabledStrategies: newStrats });
                  }}
                />
                <span className="text-xs font-bold capitalize">{strat.replace("_", " ")}</span>
              </label>
            ))}
          </div>
        </div>

        <LiquidButton onClick={saveSettings} className="w-full mt-2">
          <div className="flex items-center justify-center gap-2">
            <Save className="w-4 h-4" />
            Save Changes
          </div>
        </LiquidButton>

        <div className="text-center pt-4 space-y-1 border-t border-white/5 mt-4">
            <div className="text-[10px] text-white/20 font-mono">
                Frontend v{process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0"}
            </div>
            {versionInfo && (
                <div className="text-[10px] text-white/20 font-mono">
                    Bot v{versionInfo.currentVersion}
                    {versionInfo.hasUpdate && (
                        <a href={versionInfo.downloadUrl} target="_blank" rel="noreferrer" className="block text-emerald-400 hover:text-emerald-300 mt-1 font-bold animate-pulse">
                            Update Available: v{versionInfo.latestVersion}
                        </a>
                    )}
                </div>
            )}
        </div>
      </div>
    </GlassCard>
  );
}
