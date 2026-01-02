import PortfolioTable from "@/components/PortfolioTable";

export default function PositionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Current Positions</h1>
        <p className="text-white/40 text-sm">Active trades and holdings</p>
      </div>
      <PortfolioTable />
    </div>
  );
}
