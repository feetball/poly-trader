import { DashboardLayout } from "@/components/DashboardLayout";
import MarketScanner from "@/components/MarketScanner";
import PortfolioTable from "@/components/PortfolioTable";
import SettingsPanel from "@/components/SettingsPanel";

export default function Home() {
  return (
    <DashboardLayout>
      {/* Left Column: Scanner & Settings */}
      <div className="lg:col-span-1 space-y-6">
        <MarketScanner />
        <SettingsPanel />
      </div>

      {/* Right Column: Portfolio & Analytics */}
      <div className="lg:col-span-2 space-y-6">
        <PortfolioTable />
        
        {/* Placeholder for future Analytics Chart */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-2xl border border-white/5 bg-white/5 backdrop-blur-sm p-6 flex flex-col justify-between group hover:bg-white/10 transition-colors">
              <span className="text-xs text-white/40 uppercase tracking-wider">Metric {i}</span>
              <span className="text-2xl font-bold text-white/80 group-hover:text-white transition-colors">--</span>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
